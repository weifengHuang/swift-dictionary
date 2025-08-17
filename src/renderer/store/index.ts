import { atom } from 'jotai';

// Existing atoms
export const searchResultsAtom = atom<string[]>([]);
export const selectedTextAtom = atom<string>('');

// AI mode related atoms
export const aiModeActiveAtom = atom<boolean>(true);
export const aiSearchQueryAtom = atom<string>('');

// AI search result interface is defined in typings/index.d.ts

// Export writable atoms directly
export const aiSearchResultAtom = atom<AISearchResult | null>(null);
export const aiSearchLoadingAtom = atom<boolean>(false);
export const aiImageLoadingAtom = atom<boolean>(false);

// Error handling atoms
export const aiSearchErrorAtom = atom<AIError | null>(null);
export const aiImageErrorAtom = atom<AIError | null>(null);

// Retry mechanism atoms
export const aiRetryCountAtom = atom<number>(0);
export const aiCanRetryAtom = atom<boolean>(true);

// Helper function to parse error from IPC response
const parseAIError = (error: any): AIError => {
  if (error && typeof error === 'object' && error.type && error.message) {
    return error as AIError;
  }
  
  // Try to extract error information from error message
  const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
  
  if (errorMessage.includes('API key') || errorMessage.includes('API_KEY')) {
    return {
      type: AIErrorType.API_KEY_MISSING,
      message: 'API key is missing or invalid. Please check your configuration.',
      details: error
    };
  }
  
  if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
    return {
      type: AIErrorType.API_RATE_LIMIT,
      message: 'API rate limit exceeded. Please try again in a few moments.',
      details: error
    };
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('connection')) {
    return {
      type: AIErrorType.API_NETWORK_ERROR,
      message: 'Network error occurred. Please check your internet connection.',
      details: error
    };
  }
  
  return {
    type: AIErrorType.API_INVALID_RESPONSE,
    message: errorMessage,
    details: error
  };
};

// Async atom for AI word lookup with enhanced error handling
export const aiWordLookupAtom = atom(
  null,
  async (get, set, word: string) => {
    if (!word.trim()) {
      (set as any)(aiSearchResultAtom, null);
      (set as any)(aiSearchErrorAtom, null);
      (set as any)(aiImageErrorAtom, null);
      return;
    }

    const retryCount = get(aiRetryCountAtom);
    const maxRetries = 3;

    try {
      // Clear previous errors
      (set as any)(aiSearchErrorAtom, null);
      (set as any)(aiImageErrorAtom, null);
      
      // Set loading states
      (set as any)(aiSearchLoadingAtom, true);
      (set as any)(aiImageLoadingAtom, true);
      (set as any)(aiCanRetryAtom, retryCount < maxRetries);

      // Call AI lookup word API
      const response = await window.ipcRenderer.invoke('ai-lookup-word', word);

      if (response && response.success && response.data && response.data.definition) {
        const definition = response.data.definition;
        const result: AISearchResult = {
          word,
          definition,
          timestamp: Date.now(),
          source: 'gemini'
        };

        // Set the text result first
        (set as any)(aiSearchResultAtom, result);
        (set as any)(aiSearchLoadingAtom, false);
        (set as any)(aiRetryCountAtom, 0); // Reset retry count on success

        // Generate image asynchronously
        try {
          const imageResponse = await window.ipcRenderer.invoke('ai-generate-image', word, definition);

          if (imageResponse && imageResponse.success && imageResponse.data && imageResponse.data.imageUrl) {
            // Update result with image
            (set as any)(aiSearchResultAtom, { ...result, imageUrl: imageResponse.data.imageUrl });
            (set as any)(aiImageErrorAtom, null);
          } else if (imageResponse && !imageResponse.success && imageResponse.error) {
            // Handle structured error response
            (set as any)(aiImageErrorAtom, imageResponse.error);
          } else {
            // Image generation returned empty result
            (set as any)(aiImageErrorAtom, {
              type: AIErrorType.IMAGE_GENERATION_FAILED,
              message: 'Image generation completed but no image was returned',
              details: null
            });
          }
        } catch (imageError) {
          console.warn('Failed to generate image:', imageError);
          const parsedImageError = parseAIError(imageError);
          parsedImageError.type = AIErrorType.IMAGE_GENERATION_FAILED;
          (set as any)(aiImageErrorAtom, parsedImageError);
        } finally {
          (set as any)(aiImageLoadingAtom, false);
        }
      } else if (response && !response.success && response.error) {
        // Handle structured error response from IPC
        (set as any)(aiSearchResultAtom, null);
        (set as any)(aiSearchLoadingAtom, false);
        (set as any)(aiImageLoadingAtom, false);
        (set as any)(aiSearchErrorAtom, response.error);
        
        // Increment retry count
        (set as any)(aiRetryCountAtom, retryCount + 1);
        (set as any)(aiCanRetryAtom, retryCount + 1 < maxRetries);
      } else {
        // Definition lookup returned empty result
        (set as any)(aiSearchResultAtom, null);
        (set as any)(aiSearchLoadingAtom, false);
        (set as any)(aiImageLoadingAtom, false);
        (set as any)(aiSearchErrorAtom, {
          type: AIErrorType.API_INVALID_RESPONSE,
          message: 'No definition found for this word',
          details: null
        });
      }
    } catch (error) {
      console.error('AI word lookup failed:', error);
      
      const parsedError = parseAIError(error);
      
      (set as any)(aiSearchResultAtom, null);
      (set as any)(aiSearchLoadingAtom, false);
      (set as any)(aiImageLoadingAtom, false);
      (set as any)(aiSearchErrorAtom, parsedError);
      
      // Increment retry count
      (set as any)(aiRetryCountAtom, retryCount + 1);
      (set as any)(aiCanRetryAtom, retryCount + 1 < maxRetries);
    }
  }
);

// Retry atom for manual retry functionality
export const aiRetryLookupAtom = atom(
  null,
  async (get, set) => {
    const currentQuery = get(aiSearchQueryAtom);
    const retryCount = get(aiRetryCountAtom);
    
    if (!currentQuery.trim() || retryCount >= 3) {
      return;
    }
    
    // Reset retry count and perform lookup
    (set as any)(aiRetryCountAtom, 0);
    await (set as any)(aiWordLookupAtom, currentQuery);
  }
);

function extractSrcValue(srcString: string): string {
  const match = srcString.match(/src="(.*?)"/);
  return match ? match[1] : "";
}

async function processImage(srcString: string): Promise<string> {
  const imagePath = extractSrcValue(srcString);
  const imageBase64 = await window.ipcRenderer.invoke('lookup-word', `${imagePath}`, 'mdd');
  return srcString.replace(imagePath, `data:image/png;base64,${imageBase64}`);
}

async function processDefinition(definition: string): Promise<string> {
  const matches = definition.match(/src="(.*?)"/g);
  if (matches) {
    for (const match of matches) {
      const newStr = await processImage(match);
      definition = definition.replace(match, newStr);
    }
  }
  // definition = definition.replace(/<a href="(.*?)">/g, (match, href) => {
  //   if (href.startsWith('sound://')) {
  //     return `<a href="${href}" onClick="widow.playSound('${href}')">`;
  //   } else {
  //     return match;
  //   }
  // });
  return definition;
}


export const selectedWordDefinitionAtom = atom(async (get) => {
  const word = get(selectedTextAtom);
  if (word) {
    const definition = await window.ipcRenderer.invoke<string>(
      'lookup-word',
      word
    );
    if (definition) {
      // 这里如果查到则写到生词本；
      window.ipcRenderer.invoke('add-book', word);
      return processDefinition(definition);
    }
  }
  return null;
});
