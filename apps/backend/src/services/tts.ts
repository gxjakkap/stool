export abstract class TtsService {
  static async generate(
    text: string,
    voiceName: string = "th"
  ): Promise<string | null> {
    try {
      // Map legacy Gemini voices to language codes if needed, otherwise treat as language code
      let lang = voiceName.toLowerCase();
      if (['zephyr', 'aoede', 'kore', 'charon', 'fenrir', 'leda', 'orus'].includes(lang)) {
        lang = 'th'; // Default to Thai if an old Gemini voice name was passed
      }

      const response = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(text)}`);

      if (!response.ok) {
        console.warn(`[TtsService] Google TTS error ${response.status}`);
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      
      return `data:audio/mpeg;base64,${base64}`;
    } catch (err) {
      console.warn("[TtsService] Failed to generate TTS:", err);
      return null;
    }
  }
}
