import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const chatStickersLogger = logger.child({ module: "chat-stickers" });
import { auth } from "@/lib/auth";

// Sticker packs - using open source emojis and animated stickers
// These are categorized for easy browsing
const STICKER_PACKS = [
  {
    id: "reactions",
    name: "Reactions",
    stickers: [
      { id: "thumbs-up", emoji: "👍", label: "Thumbs Up" },
      { id: "thumbs-down", emoji: "👎", label: "Thumbs Down" },
      { id: "clap", emoji: "👏", label: "Clapping" },
      { id: "fire", emoji: "🔥", label: "Fire" },
      { id: "heart", emoji: "❤️", label: "Heart" },
      { id: "laugh", emoji: "😂", label: "Laughing" },
      { id: "mind-blown", emoji: "🤯", label: "Mind Blown" },
      { id: "rocket", emoji: "🚀", label: "Rocket" },
      { id: "100", emoji: "💯", label: "100" },
      { id: "eyes", emoji: "👀", label: "Eyes" },
      { id: "think", emoji: "🤔", label: "Thinking" },
      { id: "party", emoji: "🎉", label: "Party" },
    ],
  },
  {
    id: "crowdfunding",
    name: "Crowdfunding",
    stickers: [
      { id: "money-bag", emoji: "💰", label: "Money Bag" },
      { id: "dollar", emoji: "💵", label: "Dollar" },
      { id: "gem", emoji: "💎", label: "Gem" },
      { id: "trophy", emoji: "🏆", label: "Trophy" },
      { id: "medal", emoji: "🥇", label: "Medal" },
      { id: "target", emoji: "🎯", label: "Target" },
      { id: "chart-up", emoji: "📈", label: "Chart Up" },
      { id: "handshake", emoji: "🤝", label: "Handshake" },
      { id: "muscle", emoji: "💪", label: "Muscle" },
      { id: "star", emoji: "⭐", label: "Star" },
      { id: "crown", emoji: "👑", label: "Crown" },
      { id: "gift", emoji: "🎁", label: "Gift" },
    ],
  },
  {
    id: "comics",
    name: "Comics & Art",
    stickers: [
      { id: "art", emoji: "🎨", label: "Art" },
      { id: "pencil", emoji: "✏️", label: "Pencil" },
      { id: "book", emoji: "📚", label: "Books" },
      { id: "comic", emoji: "📖", label: "Comic" },
      { id: "superhero", emoji: "🦸", label: "Superhero" },
      { id: "villain", emoji: "🦹", label: "Villain" },
      { id: "robot", emoji: "🤖", label: "Robot" },
      { id: "alien", emoji: "👽", label: "Alien" },
      { id: "ghost", emoji: "👻", label: "Ghost" },
      { id: "dragon", emoji: "🐉", label: "Dragon" },
      { id: "unicorn", emoji: "🦄", label: "Unicorn" },
      { id: "magic", emoji: "✨", label: "Magic" },
    ],
  },
  {
    id: "emotions",
    name: "Emotions",
    stickers: [
      { id: "happy", emoji: "😊", label: "Happy" },
      { id: "love", emoji: "😍", label: "Love" },
      { id: "cool", emoji: "😎", label: "Cool" },
      { id: "wink", emoji: "😉", label: "Wink" },
      { id: "hug", emoji: "🤗", label: "Hug" },
      { id: "nervous", emoji: "😬", label: "Nervous" },
      { id: "sad", emoji: "😢", label: "Sad" },
      { id: "angry", emoji: "😤", label: "Angry" },
      { id: "surprised", emoji: "😮", label: "Surprised" },
      { id: "sleepy", emoji: "😴", label: "Sleepy" },
      { id: "sick", emoji: "🤒", label: "Sick" },
      { id: "crazy", emoji: "🤪", label: "Crazy" },
    ],
  },
  {
    id: "gestures",
    name: "Gestures",
    stickers: [
      { id: "wave", emoji: "👋", label: "Wave" },
      { id: "ok", emoji: "👌", label: "OK" },
      { id: "peace", emoji: "✌️", label: "Peace" },
      { id: "rock", emoji: "🤘", label: "Rock" },
      { id: "fist", emoji: "✊", label: "Fist" },
      { id: "pray", emoji: "🙏", label: "Pray" },
      { id: "point-up", emoji: "☝️", label: "Point Up" },
      { id: "point-right", emoji: "👉", label: "Point Right" },
      { id: "crossed-fingers", emoji: "🤞", label: "Crossed Fingers" },
      { id: "salute", emoji: "🫡", label: "Salute" },
      { id: "shrug", emoji: "🤷", label: "Shrug" },
      { id: "facepalm", emoji: "🤦", label: "Facepalm" },
    ],
  },
];

// GET - Fetch available sticker packs
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ stickerPacks: STICKER_PACKS });
  } catch (error) {
    chatStickersLogger.error({ err: String(error) }, "Error fetching stickers:");
    return NextResponse.json(
      { error: "Failed to fetch stickers" },
      { status: 500 }
    );
  }
}
