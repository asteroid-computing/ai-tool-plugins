---
tags: [skill-creator, dynamodb]
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

We're building a booking app for physiotherapy clinics on DynamoDB (Node.js + Lambda). A clinic has practitioners and patients, and patients book 30-minute appointments with a practitioner. Things we need:

- a patient signs up with an email and a phone number, and both have to be unique across the whole app (a patient can belong to several clinics)
- practitioner day view: all their appointments for a given day, in time order
- patient view: their upcoming appointments, soonest first
- clinic front desk: every appointment in the clinic for a day, across all practitioners
- dashboard shows how many appointments each practitioner has this month
- a practitioner must never be double booked for the same slot
- patients can cancel; cancelled appointments still show on the practitioner's history

Clinics have around 20 practitioners. Across the whole system we expect a peak of a few hundred bookings per minute. Can you design the table(s)? Write the design to design.md.
