# 🧠 Reverse Dictionary Game

A web-based reverse dictionary game built with **Next.js** as part of my master's thesis. Players are given a definition and must guess the correct word. Includes two gamemodes, a leaderboard, and detailed word statistics.

## 🚀 Features

- 🎮 **Two Game Modes**
  - **Test Mode**: Fixed word pool (great for controlled experiments or testing).
  - **Random Mode**: Fetches random words in real-time using an API.

- 📚 **Definition-based Word Guessing**
  - Definitions provided by [Dictionary API](https://dictionaryapi.dev/)
  - Words sourced from [Rando API](https://random-word-api.vercel.app/)

- 🏆 **Leaderboard & Stats**
  - Global leaderboard with scores, reaction times, and accuracy
  - Word-specific statistics (guess rate, average time, mistakes)

- ☁️ **Firebase Integration**
  - Stores scores, attempts and a word pool
  - Realtime leaderboard and analytics

## 🔧 Tech Stack

- **Next.js**
- **React** + **TailwindCSS**
- **Firebase Firestore**
- **Lemmatizer** for word normalization
- **Rando API**
- **Dictionary API**
