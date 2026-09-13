# Review a project before building its board

[Documentation](README.md) · [Agent Skill](../skills/delivery-board/SKILL.md)

Your coding agent can help clarify an existing project before creating its first baseline. It reads the project, asks focused questions and proposes a route for you to review.

## Start the conversation

```text
Read the Delivery Board Skill and help me review my project.
Read existing materials first. Guide me through goals, user journeys,
failure recovery, acceptance and the risks that could change the plan.
Ask one or two questions at a time in plain language.
Show me a draft route. After I confirm or adjust it, create the first baseline.
Keep existing project code and formal records intact during the review.
```

Installing the application does not start this conversation. Ask your agent to read `skills/delivery-board/SKILL.md` from its checkout, or invoke your installed Skill.

## What happens

| Step | Result |
| --- | --- |
| Read the project | Facts with sources, plus gaps in the available history |
| Discuss the gaps | Goals, first-version scope, journeys, acceptance and relevant risks |
| Draft the route | Tasks, dependencies and proposed investigations |
| Review together | Your decision on the concrete route and remaining unknowns |
| Establish the baseline | Validated formal records, ready for ongoing maintenance |

No engineering vocabulary is required. The agent can ask “What should happen if saving fails?” and turn your answer into a recovery task and acceptance condition.

## Draft or baseline?

- `.delivery-board/DISCOVERY.md` keeps findings, proposals, questions and review decisions.
- Optional `draft.graph.json` and `draft.config.json` show a clearly labeled draft.
- Existing formal records stay unchanged during review. A fresh `init` graph remains empty.
- After you confirm the route, the agent records the reviewed revision and updates the formal graph.

A baseline can include known risks and unanswered questions. Agreement on a plan does not mean its tasks are complete or its product is accepted.

This is a Skill procedure, not an application-enforced approval lock. You can still edit JSON manually. The viewer has no chat service or automatic project scanner.

## Continue later

Ask the agent to resume from `DISCOVERY.md`. It should reuse prior answers and check for project changes. Once the baseline exists, follow the [maintenance workflow](WORKFLOW.md) during authorized work.

This process helps expose missing decisions. Its effect on project success has not been measured; real user feedback and implementation checks are still needed.
