---
"chat-adapter-backlog": minor
---

Implement `parseMessage` for `BacklogAdapter`

Adds `BacklogRawMessage` type and implements `parseMessage` to convert Backlog API comment objects to Chat SDK `Message` instances. Handles null content, edited detection via created/updated comparison, and Backlog markup conversion.
