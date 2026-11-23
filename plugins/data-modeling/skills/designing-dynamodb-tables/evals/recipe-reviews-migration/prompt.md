---
tags: [skill-creator, dynamodb]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

We have a recipe app on a single DynamoDB table (PK/SK, on-demand, ~2.3M recipes, ~9M items total). Current items:

- Recipe: PK = `RECIPE#<recipeId>`, SK = `#META`, attributes include recipeId, authorId, title, createdAt
- Ingredient: PK = `RECIPE#<recipeId>`, SK = `ING#<nn>`
- Step: PK = `RECIPE#<recipeId>`, SK = `STEP#<nn>`
- Version (older revisions of the recipe): PK = `RECIPE#<recipeId>`, SK = `#V#<versionNo zero-padded>` (read newest first, descending from #META)
- Author: PK = `AUTHOR#<authorId>`, SK = `#META`
- GSI1 (GSI1PK, GSI1SK): Recipe items have GSI1PK = `AUTHOR#<authorId>`, GSI1SK = `RECIPE#<createdAt>` for the author page

The recipe page does one Query on PK = RECIPE#<id> ascending from #META and gets the recipe, ingredients and steps.

We now want reviews:
- the recipe page shows the 20 newest reviews
- a user can review a recipe only once (they can edit it)
- the recipe shows its average rating and review count
- a user's profile lists their reviews, newest first

How should we add this? Do we need a backfill? Write the plan to plan.md.
