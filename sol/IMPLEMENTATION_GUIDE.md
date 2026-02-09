# Sugar Crush - Blockchain Integration Guide

This guide maps the game's UI screens to the optimized blockchain function calls for the best user experience.

## 1. 🎬 SplashScreen
**File:** `src/screens/SplashScreen.tsx`

### Logic Update
Pre-fetch the player profile while the splash screen is visible. This allows you to route new users to a "Create Profile" flow instead of just "Home".

**Implementation Steps:**
1.  **Read:** Call `fetchPlayerProfile()` from `useCandyCrushProgram`.
2.  **Route:**
    *   If `connected` AND `playerProfile` exists → `HomeScreen`
    *   If `connected` BUT `playerProfile` is `null` → `WelcomeScreen` (trigger profile creation)
    *   If `!connected` → `WelcomeScreen`

```typescript
// Pseudo-code for useEffect
useEffect(() => {
  if (connected) {
    // Check if profile exists
    fetchPlayerProfile().then(() => {
       if (playerProfile) resetAndNavigate('HomeScreen');
       else resetAndNavigate('WelcomeScreen', { mode: 'create_profile' });
    });
  } else {
    setTimeout(() => resetAndNavigate('WelcomeScreen'), 2500);
  }
}, [connected]);
```

---

## 2. 🔗 WelcomeScreen
**File:** `src/screens/WelcomeScreen.tsx`

### Logic Update
This screen handles **Wallet Connection** AND **Player Initialization**.

**Implementation Steps:**
1.  **Connect:** User taps "Connect Wallet".
2.  **Check Profile:** After connection, check `playerProfile`.
    *   If exists → Navigate to `HomeScreen`.
    *   If `null` → Show a "Create Profile" button or modal.
3.  **Initialize:** Call `initializePlayer()` when the user approves.
    *   **UI:** Show "Creating your Candy Profile..." spinner.
    *   **Action:** `await initializePlayer()`.
    *   **Success:** Navigate to `HomeScreen`.

---

## 3. 🏠 HomeScreen
**File:** `src/screens/HomeScreen.tsx`

### Logic Update
Display real on-chain stats instead of placeholders.

**Implementation Steps:**
1.  **Data:** Use `playerProfile` from the hook.
2.  **Display:**
    *   `playerProfile.totalWins`
    *   `playerProfile.totalNftsMinted`
3.  **Background Check:** Re-verify `delegationStatus`.
    *   If an active session exists (`delegated`), show a "Resume Game" button.

---

## 4. 🎯 LevelScreen
**File:** `src/screens/LevelScreen.tsx`

### Logic Update
This is the **critical setup point**. The "Play" action here must ensure the ephemeral session is ready.

**Implementation Steps:**
1.  **Unlock Logic:**
    *   Use `playerProfile.unlockedLevels` to show detailed lock/unlock status.
2.  **The "Play" Button (`levelPressHandler`):**
    *   **Trigger:** User taps an unlocked level.
    *   **UI:** Show a "Setting up Game Board..." full-screen loader.
    *   **Action Sequence (The Bundle):**
        1.  **Session Key:** Check `sessionToken`. If expired/missing, call `createSession()` (User signs: "Approve Session").
        2.  **Start & Delegate:** Call `startGame(level)` AND `delegateGame()` (User signs: "Start Game").
            *   *Ideally bundle these if your wallet/hook supports it.*
    *   **Success:** Navigate to `GameScreen`.

```typescript
const levelPressHandler = async (id: string) => {
  setIsLoading(true); // Show loader
  try {
    // 1. Ensure Session Key (Approves gameplay for ~1h)
    if (!sessionToken) await createSession(); 
    
    // 2. Start & Delegate (Game starts on Base, moves to ER)
    // Note: Ideally bundle these
    await startGame(id); 
    await delegateGame(); 
    
    // 3. Navigate
    navigate('GameScreen', { levelId: id });
  } catch (e) {
    Alert.alert("Error starting game", e.message);
  } finally {
    setIsLoading(false);
  }
};
```

---

## 5. 🎮 GameScreen
**File:** `src/screens/GameScreen.tsx`

### Logic Update
Now purely high-speed interaction with the Ephemeral Rollup (ER).

**Implementation Steps:**
1.  **On Move (The Swap):**
    *   **Trigger:** User completes a swap.
    *   **Action:** `makeMove(fromRow, fromCol, toRow, toCol)`
    *   **Target:** **Ephemeral Rollup** (via `erProgram`).
    *   **Signer:** **Session Key** (Background signature).
    *   **UI:** *Do not block UI.* Optimistically update grid.

2.  **Game Over (Loss/Quit):**
    *   **Trigger:** Timer = 0 or No Moves.
    *   **Action:** `undelegateGame()` + `endGame(score)`.
    *   **User Action:** Signs transaction to settle stats.
    *   **Navigate:** Back to `LevelScreen`.

3.  **Victory (The Win):**
    *   **Trigger:** Target score reached.
    *   **UI:** Show "Victory! Claiming Reward..." interaction.
    *   **Action Sequence (The Bundle):**
        1.  `undelegateGame()` (Retrieve state)
        2.  `endGame(score)` (Validate win)
        3.  `mintVictoryNft()` (Mint reward)
    *   **User Action:** Signs **1 single transaction** to claim NFT & save progress.
    *   **Success:** Show "NFT Minted!" -> Navigate to `LevelScreen`.

---

## Summary of Function Calls & UX

| Screen | Function Call | Signer | UX Impact |
| :--- | :--- | :--- | :--- |
| **Welcome** | `initializePlayer` | Wallet | One-time setup. |
| **Level** | `createSession` | Wallet | Auth for popup-free play. |
| **Level** | `startGame` + `delegate` | Wallet | Sets up the high-speed lane. |
| **Game** | `makeMove` | **Session Key** | **Instant, Zero Popups.** |
| **Game** | `undelegate` + `end` + `mint` | Wallet | One final signature to claim rewards. |
