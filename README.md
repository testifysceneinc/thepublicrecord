# Global Voting Game

A high-performance real-time leaderboard application built with React, Tailwind CSS, and WebsimSocket.

## Features

- **Global Persistence**: Every vote is synced instantly across all users worldwide.
- **Dynamic Leaderboard**: Candidates are automatically ranked by vote count with smooth layout animations.
- **Interactive Feedback**: Features Framer Motion "Floating +1" animations and Canvas Confetti triggers.
- **Progressive UI**: Top 10 candidates display relative popularity bars.
- **Mobile Optimized**: Designed for one-screen height usage with internal scrolling and touch-friendly targets.

## Tech Stack

- **React 18**: For the reactive UI state.
- **Tailwind CSS**: Dark-mode slate/indigo aesthetic.
- **WebsimSocket**: Real-time database and record management.
- **Framer Motion**: Smooth entry/exit and layout transitions.
- **Canvas Confetti**: Celebration effects.

## Data Model

- `candidate_v1`: Stores unique names.
- `vote_v1`: Individual vote records associated with candidate IDs.
