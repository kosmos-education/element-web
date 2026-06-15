# Kosmos customizations

## Context

This version of element is aimed to run with the "Skolengo EN" Education Management System.
It is meant to be used only by some specific populations within schools : teachers, administration and schooling personnel.
The features accessible in the affixed matrix server are limited by choice, so these customizations are made to adjust the front-end to these impossibilities.

## Features

### Removing access to space creation

Users won't be allowed to create Spaces so we took off the buttons to do so.

### Removing access to creation of 1-1 chats

Our users have pre-created rooms to chat in, we don't allow the creation of 1-1 chats.

**v1.12.21+ note:** the compose button (new chat / new room / new video room) moved to
`packages/shared-components/src/room-list/RoomListHeaderView/RoomListHeaderView.tsx` —
the `displayComposeMenu` / `useComposeIcon` block was removed entirely from that file.

### Removing visible access to room creation

As for 1-1 chats, room creation is highly restricted so we took off the most obvious buttons to reduce frustration.

**v1.12.21+ note:** the creation buttons in the empty room list state moved to
`packages/shared-components/src/room-list/RoomListView/RoomListEmptyStateView.tsx` —
the `description` prop and the `<Button>` children were removed from the default (no active filter) branch.
The "people" filter chip is hidden via `apps/web/src/viewmodels/room-list/RoomListViewModel.ts`
(filtered from `filterIds` alongside favourite/low-priority).

### Removing visible mentions of encryption

We designed the solution in order to avoid needing to encrypt the server, so to avoid confusion and concern
among our users, we chose to take off the mentions on unencrypted messages and rooms.

### Removing Polls and Extensions entries

Both are not configured in the server but the buttons were still there doing nothing.

### Removing infinite loader on verification pill

The server doesn't allow this call so the loader was infinite in the right panel.

### Adding an entry directing to the FAQ

In the Space Panel, we added a button directing to the FAQ set in the help_url configuration parameter.

### Branding the favicon

Changing the favicon logos to ours.

### Adding a specific error message when uploading files

When a users tries to upload a file exceeding their quota (size per week for example), the error messages now mentions it.

### Neutral placeholder text in the message composer

Since upstream v1.12.21, the default composer placeholder keys (`composer|placeholder`, `composer|placeholder_reply`, `composer|placeholder_thread`) now explicitly mention "unencrypted" in their text (e.g. "Send an unencrypted message…"). To stay consistent with our goal of hiding encryption mentions, `MessageComposer.tsx` now always uses the `_encrypted` variants of those keys (`composer|placeholder_encrypted`, etc.), which carry neutral wording regardless of the room's actual encryption status. The corresponding `fr.json` overrides and the Jest unit tests (`MessageComposer-test.tsx`, `test-utils/composer.ts`) were updated accordingly.
