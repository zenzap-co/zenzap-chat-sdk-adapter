# Sample Zenzap messages

Real payload examples from the Zenzap long-polling API (`GET /v2/updates`).

## Text message

```json
{
  "updateId": "upd_abc123",
  "eventType": "message.created",
  "createdAt": 1700000000000,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "topicId": "660e8400-e29b-41d4-a716-446655440002",
    "senderId": "770e8400-e29b-41d4-a716-446655440003",
    "senderName": "Alice",
    "senderType": "user",
    "text": "Hello team!",
    "createdAt": 1700000000000,
    "updatedAt": 1700000000000,
    "isEdited": false,
    "isSystem": false,
    "replyCount": 0,
    "attachments": [],
    "mentions": [],
    "reactions": []
  }
}
```

## Message with mention

```json
{
  "updateId": "upd_def456",
  "eventType": "message.created",
  "createdAt": 1700000001000,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "topicId": "660e8400-e29b-41d4-a716-446655440002",
    "senderId": "770e8400-e29b-41d4-a716-446655440003",
    "senderName": "Alice",
    "senderType": "user",
    "text": "Hey <@b@880e8400-e29b-41d4-a716-446655440004>, can you help?",
    "createdAt": 1700000001000,
    "updatedAt": 1700000001000,
    "isEdited": false,
    "isSystem": false,
    "replyCount": 0,
    "attachments": [],
    "mentions": [
      {
        "id": "b@880e8400-e29b-41d4-a716-446655440004",
        "name": "API Bot"
      }
    ],
    "reactions": []
  }
}
```

## Message with attachment

```json
{
  "updateId": "upd_ghi789",
  "eventType": "message.created",
  "createdAt": 1700000002000,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440020",
    "topicId": "660e8400-e29b-41d4-a716-446655440002",
    "senderId": "770e8400-e29b-41d4-a716-446655440003",
    "senderName": "Alice",
    "senderType": "user",
    "text": "Here's the screenshot",
    "createdAt": 1700000002000,
    "updatedAt": 1700000002000,
    "isEdited": false,
    "isSystem": false,
    "replyCount": 0,
    "attachments": [
      {
        "id": "att-001",
        "type": "image",
        "name": "screenshot.png",
        "url": "https://storage.zenzap.co/files/att-001/screenshot.png"
      }
    ],
    "mentions": [],
    "reactions": []
  }
}
```

## Bot message

```json
{
  "updateId": "upd_jkl012",
  "eventType": "message.created",
  "createdAt": 1700000003000,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440030",
    "topicId": "660e8400-e29b-41d4-a716-446655440002",
    "senderId": "b@880e8400-e29b-41d4-a716-446655440004",
    "senderName": "API Bot",
    "senderType": "bot",
    "text": "Got it! Working on it now.",
    "createdAt": 1700000003000,
    "updatedAt": 1700000003000,
    "isEdited": false,
    "isSystem": false,
    "replyCount": 0,
    "attachments": [],
    "mentions": [],
    "reactions": []
  }
}
```

## Reaction added

```json
{
  "updateId": "upd_mno345",
  "eventType": "reaction.added",
  "createdAt": 1700000004000,
  "data": {
    "messageId": "550e8400-e29b-41d4-a716-446655440001",
    "topicId": "660e8400-e29b-41d4-a716-446655440002",
    "userId": "770e8400-e29b-41d4-a716-446655440003",
    "reaction": "👍"
  }
}
```

## Edited message

```json
{
  "updateId": "upd_pqr678",
  "eventType": "message.updated",
  "createdAt": 1700000005000,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "topicId": "660e8400-e29b-41d4-a716-446655440002",
    "senderId": "770e8400-e29b-41d4-a716-446655440003",
    "senderName": "Alice",
    "senderType": "user",
    "text": "Hello team! (edited)",
    "createdAt": 1700000000000,
    "updatedAt": 1700000005000,
    "isEdited": true,
    "isSystem": false,
    "replyCount": 0,
    "attachments": [],
    "mentions": [],
    "reactions": []
  }
}
```
