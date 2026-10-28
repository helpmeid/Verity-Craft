# Verity-Craft
a card game you'll love

## Game modes

- **Guess the Variety**: Guess how many copies of a variety card another player holds.
- **Unoity**: Play cards that match the current suit or variety. Action cards include Skipity, Reversity, Drawity, Wildity, and Draw Fourity.

Character cards use standalone PNG artwork cropped from `assets/character-sheet.png` in `assets/cards/`. During a game, use **View all cards** to browse the character cards and Lord Verity pieces. In Unoity, every card face uses character artwork without visible text, and the hand appears on the right side of the table.

Hosts can drag the turn-duration slider from 30 seconds to 3 minutes in 15-second increments (1:30 is the default), or select **No time limit**. The countdown bar changes from green to red, and players get a prominent alert when their turn starts. Expired turns are skipped automatically; in Unoity, the turn passes even if the player already drew a card.

Click the **Debug** button in the bottom-right corner of the main menu to show or hide solo-testing controls. Choose a mode, opponent count, and short test turn duration to start a local game with simulated opponents; no network lobby is needed.

Hosts can turn Lord Verity corner cards on or off in Guess the Variety match settings. When enabled, the four corners are randomly distributed into players' assembly areas and count toward their starting card limit. A three-corner start has a 1% chance; otherwise players start with at most two, and no one can start with all four. Opponent panels show assembled corners as ordinary card backs. Eliminating a player transfers their assembled corners to the player who eliminated them.

The game version is shown in the bottom-left corner. Multiplayer lobbies require both players to run the same version; a mismatch is reported instead of allowing an incompatible connection. Update `GAME_VERSION` in `game.js` whenever publishing a new release so players can tell which ZIP they have.
