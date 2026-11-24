---
tags: [skill-creator, dynamodb]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

We run a conference app on DynamoDB (TypeScript on Lambda). Each conference has about 120 sessions over 3 days, about 200 speakers and up to 20,000 attendees. A session has 1 to 4 speakers, and a speaker can give several sessions.

Screens and actions:

- session page: the session (title, abstract, room, start and end time, seats left) with its speakers' names, photos and short bios
- speaker page: the speaker's name, photo and full bio, and their sessions with title, room and start time
- day agenda: every session of the conference on one day, by start time, with seats left. During the event the attendee app reloads it every 30 seconds for every attendee who has it open, and most of the 20,000 do
- my schedule: the sessions an attendee saved, by start time
- an attendee saves a session; a session has a seat limit and must never be overbooked; saving twice by mistake (double tap, retry) must not take two seats
- an attendee removes a saved session
- speakers edit their bio and photo a few times before the event
- organisers sometimes move a session to another time or room, until the day before the event

Sessions are about 1 KB, speakers 2 KB with the full bio. Can you design the table(s)? Write the design to design.md.
