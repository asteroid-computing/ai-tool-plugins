// Command gocomments finds citations and history in a Go module's comments, and checks that a change touched nothing but comments.
//
// Usage:
//
//	go run -C <this directory> . [-repo dir] find [path ...]
//	go run -C <this directory> . [-repo dir] same <base>
//
// find lists each comment line in the .go files under the paths (default ".") that matches a citation or history pattern, as file:line: text.
// It skips directives, cgo preambles, the expected output of examples, generated files, and the vendor and testdata directories.
// It exits 1 when it lists anything.
//
// same compares every .go file that differs between the git revision base and the working tree, and reports each whose tokens, directives or cgo preamble differ.
// Added, deleted and renamed .go files are reported too, and changed files of other types are listed as not checked.
// It exits 1 when any .go file changed more than its comments.
//
// Both run in the directory named by -repo, default the current one; `go run -C` builds the tool in its own directory, so pass -repo "$PWD".
package main

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"go/ast"
	"go/parser"
	"go/scanner"
	"go/token"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

// candidate matches the citation and history forms a comment should not hold.
// A match is a candidate only: an external fact such as golang/go#22682 matches too, and a reader decides.
var candidate = regexp.MustCompile(`\bADR[- ]?\d+|\b[Dd]ecisions? \d+|\(#\d+\)|#\d{2,}\b|issues/\d+|pull/\d+|\bas amended\b|\b(used to|no longer|previously|for now)\b`)

func main() {
	repo := flag.String("repo", ".", "the directory to run in: the module's root")
	flag.Usage = func() {
		fmt.Fprintln(os.Stderr, "usage: gocomments [-repo dir] find [path ...]")
		fmt.Fprintln(os.Stderr, "       gocomments [-repo dir] same <base>")
	}
	flag.Parse()
	if err := os.Chdir(*repo); err != nil {
		fmt.Fprintln(os.Stderr, "gocomments:", err)
		os.Exit(2)
	}
	args := flag.Args()
	var code int
	var err error
	switch {
	case len(args) >= 1 && args[0] == "find":
		code, err = runFind(args[1:])
	case len(args) == 2 && args[0] == "same":
		code, err = runSame(args[1])
	default:
		flag.Usage()
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "gocomments:", err)
		os.Exit(2)
	}
	os.Exit(code)
}

// A match is one comment line that matches [candidate].
type match struct {
	Line int
	Text string
}

func runFind(paths []string) (int, error) {
	if len(paths) == 0 {
		paths = []string{"."}
	}
	var n int
	for _, root := range paths {
		err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() {
				if path != root && skipDir(d.Name()) {
					return filepath.SkipDir
				}
				return nil
			}
			if !strings.HasSuffix(path, ".go") {
				return nil
			}
			src, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			matches, err := findCandidates(path, src)
			if err != nil {
				return err
			}
			for _, m := range matches {
				fmt.Printf("%s:%d: %s\n", path, m.Line, m.Text)
			}
			n += len(matches)
			return nil
		})
		if err != nil {
			return 2, err
		}
	}
	if n > 0 {
		fmt.Fprintf(os.Stderr, "%d candidate lines\n", n)
		return 1, nil
	}
	return 0, nil
}

// skipDir reports whether find leaves out a directory: the ones the go tool ignores, vendor and testdata.
func skipDir(name string) bool {
	return name == "vendor" || name == "testdata" || strings.HasPrefix(name, ".") || strings.HasPrefix(name, "_")
}

// findCandidates returns the comment lines in src that match [candidate], leaving out directives, the cgo preamble and examples' expected output.
// It returns nothing for a generated file.
func findCandidates(filename string, src []byte) ([]match, error) {
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, filename, src, parser.ParseComments)
	if err != nil {
		return nil, fmt.Errorf("parsing %s: %w", filename, err)
	}
	if ast.IsGenerated(f) {
		return nil, nil
	}
	skip := map[*ast.CommentGroup]bool{}
	if g := cgoPreamble(f); g != nil {
		skip[g] = true
	}
	for _, g := range exampleOutputs(f) {
		skip[g] = true
	}
	var matches []match
	for _, g := range f.Comments {
		if skip[g] {
			continue
		}
		for _, c := range g.List {
			if isDirective(c.Text) {
				continue
			}
			line := fset.Position(c.Slash).Line
			for i, text := range strings.Split(c.Text, "\n") {
				if candidate.MatchString(text) {
					matches = append(matches, match{Line: line + i, Text: strings.TrimSpace(text)})
				}
			}
		}
	}
	return matches, nil
}

// directive matches a directive comment as go.dev/doc/comment#directives defines it, the compiler's /*line form, and the old // +build constraint.
var directive = regexp.MustCompile(`^(//(line |extern |export |[a-z0-9]+:[a-z0-9])|/\*line |// \+build )`)

// isDirective reports whether a comment is one a tool reads: the go tool's, the compiler's and cgo's, and other tools' //toolname:directive lines.
func isDirective(text string) bool {
	return directive.MatchString(text)
}

// cgoPreamble returns the comment above import "C", or nil if the file has none.
func cgoPreamble(f *ast.File) *ast.CommentGroup {
	for _, decl := range f.Decls {
		gen, ok := decl.(*ast.GenDecl)
		if !ok || gen.Tok != token.IMPORT {
			continue
		}
		for _, spec := range gen.Specs {
			imp := spec.(*ast.ImportSpec)
			if imp.Path.Value != `"C"` {
				continue
			}
			if imp.Doc != nil {
				return imp.Doc
			}
			return gen.Doc
		}
	}
	return nil
}

// exampleOutputs returns the comment groups in Example functions that hold their expected output.
func exampleOutputs(f *ast.File) []*ast.CommentGroup {
	var groups []*ast.CommentGroup
	for _, decl := range f.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Body == nil || !strings.HasPrefix(fn.Name.Name, "Example") {
			continue
		}
		for _, g := range f.Comments {
			if g.Pos() < fn.Body.Lbrace || g.End() > fn.Body.Rbrace {
				continue
			}
			text := strings.TrimSpace(g.Text())
			if strings.HasPrefix(text, "Output:") || strings.HasPrefix(text, "Unordered output:") {
				groups = append(groups, g)
			}
		}
	}
	return groups
}

func runSame(base string) (int, error) {
	out, err := exec.Command("git", "diff", "--name-status", "--no-renames", base, "--").Output()
	if err != nil {
		return 2, fmt.Errorf("listing changes since %s: %w", base, gitError(err))
	}
	var changed int
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		status, path, _ := strings.Cut(line, "\t")
		if !strings.HasSuffix(path, ".go") {
			fmt.Printf("%s: not checked (not a .go file)\n", path)
			continue
		}
		if status != "M" {
			what, ok := map[string]string{"A": "added", "D": "deleted", "T": "type changed"}[status]
			if !ok {
				what = "status " + status
			}
			fmt.Printf("%s: %s, not a comment change\n", path, what)
			changed++
			continue
		}
		old, err := exec.Command("git", "show", base+":"+path).Output()
		if err != nil {
			return 2, fmt.Errorf("reading %s at %s: %w", path, base, gitError(err))
		}
		cur, err := os.ReadFile(path)
		if err != nil {
			return 2, err
		}
		reason, err := diffBeyondComments(path, old, cur)
		if err != nil {
			return 2, err
		}
		if reason != "" {
			fmt.Printf("%s: %s\n", path, reason)
			changed++
		}
	}
	if changed > 0 {
		return 1, nil
	}
	return 0, nil
}

// gitError adds git's stderr to an exit error.
func gitError(err error) error {
	var exit *exec.ExitError
	if errors.As(err, &exit) && len(exit.Stderr) > 0 {
		return fmt.Errorf("%w: %s", err, bytes.TrimSpace(exit.Stderr))
	}
	return err
}

// diffBeyondComments returns why the two versions of a Go file differ in more than their comments, or "" if they differ only in comments.
// It compares their tokens, their directives in order and their cgo preambles; a generated file must not change at all.
func diffBeyondComments(filename string, old, cur []byte) (string, error) {
	if bytes.Equal(old, cur) {
		return "", nil
	}
	oldTokens, err := tokens(filename, old)
	if err != nil {
		return "", err
	}
	curTokens, err := tokens(filename, cur)
	if err != nil {
		return "", err
	}
	if line := firstDifference(oldTokens, curTokens); line > 0 {
		return fmt.Sprintf("code changed, from line %d", line), nil
	}
	oldFacts, err := commentFacts(filename, old)
	if err != nil {
		return "", err
	}
	curFacts, err := commentFacts(filename, cur)
	if err != nil {
		return "", err
	}
	switch {
	case oldFacts.generated || curFacts.generated:
		return "generated file changed", nil
	case strings.Join(oldFacts.directives, "\n") != strings.Join(curFacts.directives, "\n"):
		return "directives changed", nil
	case oldFacts.preamble != curFacts.preamble:
		return "cgo preamble changed", nil
	}
	return "", nil
}

// A lexeme is one token of a file without its comments: its kind and literal, and the line it is on.
type lexeme struct {
	Text string
	Line int
}

// tokens returns src's tokens without comments; an automatic semicolon's literal is dropped, so a removed end-of-line comment changes nothing.
func tokens(filename string, src []byte) ([]lexeme, error) {
	fset := token.NewFileSet()
	file := fset.AddFile(filename, -1, len(src))
	var errs scanner.ErrorList
	var s scanner.Scanner
	s.Init(file, src, func(pos token.Position, msg string) { errs.Add(pos, msg) }, 0)
	var list []lexeme
	for {
		pos, tok, lit := s.Scan()
		if tok == token.EOF {
			break
		}
		if tok == token.SEMICOLON {
			lit = ""
		}
		list = append(list, lexeme{Text: tok.String() + " " + lit, Line: file.Line(pos)})
	}
	if err := errs.Err(); err != nil {
		return nil, fmt.Errorf("scanning %s: %w", filename, err)
	}
	return list, nil
}

// firstDifference returns the line in cur of the first token that differs from old, or 0 if their tokens are the same.
// A difference at the end of cur is reported at its last line.
func firstDifference(old, cur []lexeme) int {
	for i := range min(len(old), len(cur)) {
		if old[i].Text != cur[i].Text {
			return cur[i].Line
		}
	}
	switch {
	case len(old) == len(cur):
		return 0
	case len(cur) > len(old):
		return cur[len(old)].Line
	case len(cur) > 0:
		return cur[len(cur)-1].Line
	}
	return 1
}

// facts are the parts of a file's comments that are code: its directives, its cgo preamble, and whether it is generated.
type facts struct {
	directives []string
	preamble   string
	generated  bool
}

func commentFacts(filename string, src []byte) (facts, error) {
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, filename, src, parser.ParseComments)
	if err != nil {
		return facts{}, fmt.Errorf("parsing %s: %w", filename, err)
	}
	var out facts
	out.generated = ast.IsGenerated(f)
	for _, g := range f.Comments {
		for _, c := range g.List {
			if isDirective(c.Text) {
				out.directives = append(out.directives, c.Text)
			}
		}
	}
	if g := cgoPreamble(f); g != nil {
		for _, c := range g.List {
			out.preamble += c.Text + "\n"
		}
	}
	return out, nil
}
