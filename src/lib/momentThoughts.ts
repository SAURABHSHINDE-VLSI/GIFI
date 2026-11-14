export const ROMANTIC_THOUGHTS = {
  peace: [
    "Peace, love, and your beautiful face ✌️💕",
    "Two fingers up, one heart completely yours ✌️❤️",
    "Freezing this silly, perfect second with you ✌️✨",
    "Caught in a moment where time stood still with you ✌️",
    "Proof that my favorite place is whenever you're on my screen ✌️💫",
    "Peace signs and butterflies every single time ✌️🦋",
    "My favorite view in the whole wide world ✌️✨",
    "Just you, me, and our little infinite world ✌️💖",
    "Smiling back at my favorite person on earth ✌️🥰",
  ],
  heart: [
    "A tiny heart that beats only for you 🫰💖",
    "Sending all my love straight through the screen 🫰✨",
    "You make my heart do little somersaults 🫰🥰",
    "Proof that my heart is always safe in your hands 🫰❤️",
    "A pocket-sized heart with ocean-sized love 🫰🌊",
    "Every heartbeat belongs to you 🫰💕",
  ],
  kiss: [
    "A kiss across the miles until I can kiss you for real 💋",
    "Sending you a million kisses through the glass 💋✨",
    "Save this kiss in your pocket for later 💋❤️",
    "Craving your lips and your warm hug 💋🌹",
    "One kiss closer to our next hug 💋",
  ],
  movie: [
    "Movie nights are infinitely sweeter with you 🍿✨",
    "Sharing the screen, sharing our whole world 🎬❤️",
    "The best part of any show is watching it with you 🌙",
    "Laughing at the same scene from miles apart 🍿💕",
  ],
  doodle: [
    "Doodling our love across the miles 🎨💖",
    "Every color reminds me of you 🌈✨",
    "Art is sweet, but you're my favorite masterpiece 🎨❤️",
    "Drawing little pieces of our hearts together 🎨💌",
  ],
  general: [
    "Every call with you feels like coming home 🏡❤️",
    "Late night laughter and memories we get to keep forever 🌙",
    "Can't wait until this screen turns into a tight hug 🫂",
    "You make ordinary hours feel like poetry 📖✨",
    "A little piece of forever saved just for us 💌",
    "Forever my favorite notification 💬❤️",
    "Distance means nothing when someone means this much 💫",
    "No place I'd rather be than right here with you 🌹",
    "Soft smiles across the miles 🥰",
    "Another sweet page in our favorite story 📖✨",
    "My heart feels full every single time I see you ♡",
    "Counting down the hours until our next call ⏳💖",
    "Some moments are too sweet not to keep forever 🔒✨",
  ],
};

export function getThoughtsForMoment(caption?: string): string[] {
  const cap = (caption || "").toLowerCase();
  if (cap.includes("✌") || cap.includes("peace")) return ROMANTIC_THOUGHTS.peace;
  if (cap.includes("🫰") || cap.includes("heart")) return ROMANTIC_THOUGHTS.heart;
  if (cap.includes("💋") || cap.includes("kiss") || cap.includes("pucker")) return ROMANTIC_THOUGHTS.kiss;
  if (cap.includes("🎬") || cap.includes("watch") || cap.includes("youtube") || cap.includes("movie")) return ROMANTIC_THOUGHTS.movie;
  if (cap.includes("🎨") || cap.includes("doodle") || cap.includes("canvas") || cap.includes("draw")) return ROMANTIC_THOUGHTS.doodle;
  return ROMANTIC_THOUGHTS.general;
}

export function getDefaultThought(caption?: string, seed?: string | number): string {
  const list = getThoughtsForMoment(caption);
  if (!list.length) return "A sweet memory saved just for us 💕";
  if (!seed) return list[0];

  let hash = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % list.length;
  return list[index];
}

