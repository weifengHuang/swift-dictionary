import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import log from 'electron-log';

// Load environment variables
dotenv.config();

/**
 * Error types for Gemini API operations
 */
export enum GeminiErrorType {
    API_KEY_MISSING = 'API_KEY_MISSING',
    API_RATE_LIMIT = 'API_RATE_LIMIT',
    API_NETWORK_ERROR = 'API_NETWORK_ERROR',
    API_INVALID_RESPONSE = 'API_INVALID_RESPONSE',
    IMAGE_GENERATION_FAILED = 'IMAGE_GENERATION_FAILED',
    CONFIGURATION_ERROR = 'CONFIGURATION_ERROR'
}

/**
 * Custom error class for Gemini API operations
 */
export class GeminiError extends Error {
    constructor(
        public type: GeminiErrorType,
        message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'GeminiError';
    }
}

/**
 * Configuration interface for Gemini API
 */
interface GeminiConfig {
    apiKey: string;
    textModel: string;
    imageModel: string;
    baseUrl?: string;
}

/**
 * GeminiService class handles all interactions with Google's Gemini API
 * Provides text generation and image generation capabilities
 */
export class GeminiService {
    private genAI: GoogleGenerativeAI | null = null;
    private textModel: GenerativeModel | null = null;
    private imageModel: GenerativeModel | null = null;
    private config: GeminiConfig | null = null;
    private isInitialized = false;

    constructor() {
        this.initializeService();
    }

    /**
     * Initialize the Gemini service with configuration from environment variables
     */
    private initializeService(): void {
        try {
            log.info('Initializing GeminiService...');

            const apiKey = process.env.GEMINI_API_KEY;
            const textModel = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
            const imageModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-preview-image-generation';
            const baseUrl = process.env.GEMINI_API_BASE_URL;

            if (!apiKey || apiKey === 'your_gemini_api_key_here') {
                log.error('Gemini API key is missing or not configured');
                throw new GeminiError(
                    GeminiErrorType.API_KEY_MISSING,
                    'Gemini API key is missing. Please configure GEMINI_API_KEY in your .env file.'
                );
            }

            this.config = {
                apiKey,
                textModel,
                imageModel,
                baseUrl
            };

            // Initialize Google Generative AI client
            this.genAI = new GoogleGenerativeAI(apiKey);

            // Initialize models
            this.textModel = this.genAI.getGenerativeModel({ model: textModel });
            this.imageModel = this.genAI.getGenerativeModel({ model: imageModel });

            this.isInitialized = true;
            log.info('GeminiService initialized successfully');
            log.info(`Text model: ${textModel}`);
            log.info(`Image model: ${imageModel}`);

        } catch (error) {
            log.error('Failed to initialize GeminiService:', error);
            this.isInitialized = false;

            if (error instanceof GeminiError) {
                throw error;
            }

            throw new GeminiError(
                GeminiErrorType.CONFIGURATION_ERROR,
                'Failed to initialize Gemini service',
                error
            );
        }
    }

    /**
     * Check if the service is properly configured and initialized
     */
    public isConfigured(): boolean {
        return this.isInitialized &&
            this.config !== null &&
            this.genAI !== null &&
            this.textModel !== null &&
            this.imageModel !== null;
    }

    /**
     * Validate API key format and configuration
     */
    public validateConfiguration(): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!this.config) {
            errors.push('Service not initialized');
            return { isValid: false, errors };
        }

        if (!this.config.apiKey || this.config.apiKey === 'your_gemini_api_key_here') {
            errors.push('API key is missing or using placeholder value');
        }

        if (!this.config.textModel) {
            errors.push('Text model configuration is missing');
        }

        if (!this.config.imageModel) {
            errors.push('Image model configuration is missing');
        }

        if (!this.isInitialized) {
            errors.push('Service initialization failed');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get current configuration (without exposing sensitive data)
     */
    public getConfiguration(): Partial<GeminiConfig> | null {
        if (!this.config) {
            return null;
        }

        return {
            textModel: this.config.textModel,
            imageModel: this.config.imageModel,
            baseUrl: this.config.baseUrl,
            apiKey: this.config.apiKey ? '***configured***' : 'missing'
        };
    }

    /**
     * Test the API connection with a simple request
     */
    public async testConnection(): Promise<{ success: boolean; error?: string }> {
        try {
            if (!this.isConfigured()) {
                return {
                    success: false,
                    error: 'Service not properly configured'
                };
            }

            log.info('Testing Gemini API connection...');

            // Simple test request
            const result = await this.textModel!.generateContent('Hello');
            const response = await result.response;

            if (response && response.text()) {
                log.info('Gemini API connection test successful');
                return { success: true };
            } else {
                log.error('Gemini API connection test failed: No response text');
                return {
                    success: false,
                    error: 'Invalid response from API'
                };
            }

        } catch (error) {
            log.error('Gemini API connection test failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Handle and categorize API errors
     */
    private handleApiError(error: any): GeminiError {
        log.error('Gemini API error:', error);

        // Check for specific error types
        if (error.message?.includes('API_KEY')) {
            return new GeminiError(
                GeminiErrorType.API_KEY_MISSING,
                'Invalid or missing API key',
                error
            );
        }

        if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
            return new GeminiError(
                GeminiErrorType.API_RATE_LIMIT,
                'API rate limit exceeded. Please try again later.',
                error
            );
        }

        if (error.code === 'NETWORK_ERROR' || error.message?.includes('network')) {
            return new GeminiError(
                GeminiErrorType.API_NETWORK_ERROR,
                'Network error occurred. Please check your internet connection.',
                error
            );
        }

        // Default to generic API error
        return new GeminiError(
            GeminiErrorType.API_INVALID_RESPONSE,
            error.message || 'An error occurred while calling the Gemini API',
            error
        );
    }

    /**
     * Get the text model instance (for internal use)
     */
    protected getTextModel(): GenerativeModel {
        if (!this.textModel) {
            throw new GeminiError(
                GeminiErrorType.CONFIGURATION_ERROR,
                'Text model not initialized'
            );
        }
        return this.textModel;
    }

    /**
     * Get the image model instance (for internal use)
     */
    protected getImageModel(): GenerativeModel {
        if (!this.imageModel) {
            throw new GeminiError(
                GeminiErrorType.CONFIGURATION_ERROR,
                'Image model not initialized'
            );
        }
        return this.imageModel;
    }

    /**
     * Get detailed English definition and explanation for a word
     * @param word - The English word to look up
     * @returns Promise<string> - Formatted definition and explanation
     */
    public async getWordDefinition(word: string): Promise<string> {
        try {
            if (!this.isConfigured()) {
                throw new GeminiError(
                    GeminiErrorType.CONFIGURATION_ERROR,
                    'Gemini service is not properly configured'
                );
            }

            if (!word || word.trim().length === 0) {
                throw new GeminiError(
                    GeminiErrorType.API_INVALID_RESPONSE,
                    'Word parameter is required and cannot be empty'
                );
            }

            const cleanWord = word.trim().toLowerCase();
            log.info(`Looking up word definition for: ${cleanWord}`);

            // Create a comprehensive prompt for word definition
            const prompt = this.buildWordDefinitionPrompt(cleanWord);

            const model = this.getTextModel();
            const result = await model.generateContent(prompt);
            const response = await result.response;

            if (!response) {
                throw new GeminiError(
                    GeminiErrorType.API_INVALID_RESPONSE,
                    'No response received from Gemini API'
                );
            }

            const text = response.text();
            if (!text || text.trim().length === 0) {
                throw new GeminiError(
                    GeminiErrorType.API_INVALID_RESPONSE,
                    'Empty response received from Gemini API'
                );
            }

            const formattedDefinition = this.formatWordDefinition(text, cleanWord);
            log.info(`Successfully retrieved definition for word: ${cleanWord}`);

            return formattedDefinition;

        } catch (error) {
            if (error instanceof GeminiError) {
                throw error;
            }
            throw this.handleApiError(error);
        }
    }

    /**
     * Build a comprehensive prompt for word definition lookup
     */
    private buildWordDefinitionPrompt(word: string): string {
        return `Please provide a comprehensive English definition and explanation for the word "${word}". 

Include the following information:
1. **Definition**: Clear and concise meaning(s) of the word
2. **Part of Speech**: Noun, verb, adjective, etc.
3. **Pronunciation**: Phonetic pronunciation if helpful
4. **Etymology**: Brief origin of the word if interesting
5. **Usage Examples**: 2-3 practical example sentences
6. **Synonyms**: Related words with similar meanings
7. **Antonyms**: Words with opposite meanings (if applicable)
8. **Common Phrases**: Idioms or phrases that use this word
9. **Usage Notes**: Any important grammar or usage considerations

Format the response in a clear, educational manner suitable for English language learners. Use markdown formatting for better readability.

Word: ${word}`;
    }

    /**
     * Format and clean the word definition response
     */
    private formatWordDefinition(rawText: string, word: string): string {
        try {
            // Clean up the response text
            let formatted = rawText.trim();

            // Ensure the word is properly capitalized in the response
            const wordRegex = new RegExp(`\\b${word}\\b`, 'gi');
            formatted = formatted.replace(wordRegex, (match) => {
                // Keep original case for the first occurrence, capitalize others appropriately
                return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
            });

            // Add a header if not present
            if (!formatted.toLowerCase().includes(`# ${word.toLowerCase()}`)) {
                formatted = `# ${word.charAt(0).toUpperCase() + word.slice(1)}\n\n${formatted}`;
            }

            // Ensure proper markdown formatting
            formatted = this.ensureMarkdownFormatting(formatted);

            return formatted;

        } catch (error) {
            log.warn('Error formatting word definition, returning raw text:', error);
            return rawText;
        }
    }

    /**
     * Ensure proper markdown formatting in the response
     */
    private ensureMarkdownFormatting(text: string): string {
        // Add proper spacing around headers
        text = text.replace(/^(#{1,6})\s*(.+)$/gm, '$1 $2\n');

        // Ensure double line breaks before headers (except the first one)
        text = text.replace(/\n(#{1,6}\s)/g, '\n\n$1');

        // Clean up multiple consecutive line breaks
        text = text.replace(/\n{3,}/g, '\n\n');

        // Ensure proper list formatting
        text = text.replace(/^\s*(\d+\.|\*|\-)\s*/gm, '$1 ');

        return text.trim();
    }

    /**
     * Validate if a word is suitable for lookup
     */
    public validateWord(word: string): { isValid: boolean; error?: string } {
        if (!word || typeof word !== 'string') {
            return { isValid: false, error: 'Word must be a non-empty string' };
        }

        const trimmed = word.trim();
        if (trimmed.length === 0) {
            return { isValid: false, error: 'Word cannot be empty' };
        }

        if (trimmed.length > 100) {
            return { isValid: false, error: 'Word is too long (max 100 characters)' };
        }

        // Check for basic English word pattern (letters, hyphens, apostrophes)
        const wordPattern = /^[a-zA-Z\-']+$/;
        if (!wordPattern.test(trimmed)) {
            return { isValid: false, error: 'Word contains invalid characters' };
        }

        return { isValid: true };
    }

    /**
     * Generate an educational image related to a word
     * @param word - The English word to generate an image for
     * @param definition - Optional definition context to improve image generation
     * @returns Promise<string> - Base64 encoded image data
     */
    public async generateWordImage(word: string, definition?: string): Promise<string> {
        try {
            if (!this.isConfigured()) {
                throw new GeminiError(
                    GeminiErrorType.CONFIGURATION_ERROR,
                    'Gemini service is not properly configured'
                );
            }

            const validation = this.validateWord(word);
            if (!validation.isValid) {
                throw new GeminiError(
                    GeminiErrorType.API_INVALID_RESPONSE,
                    validation.error || 'Invalid word provided'
                );
            }

            const cleanWord = word.trim().toLowerCase();
            log.info(`Generating image for word: ${cleanWord}`);

            // Build image generation prompt
            const prompt = this.buildImageGenerationPrompt(cleanWord, definition);

            const model = this.getImageModel();
            const result = await model.generateContent(prompt);
            const response = await result.response;

            if (!response) {
                throw new GeminiError(
                    GeminiErrorType.IMAGE_GENERATION_FAILED,
                    'No response received from Gemini image generation API'
                );
            }

            // Extract image data from response
            const imageData = this.extractImageData(response);

            if (!imageData) {
                throw new GeminiError(
                    GeminiErrorType.IMAGE_GENERATION_FAILED,
                    'No image data found in API response'
                );
            }

            log.info(`Successfully generated image for word: ${cleanWord}`);
            return imageData;

        } catch (error) {
            if (error instanceof GeminiError) {
                throw error;
            }

            // Handle image generation specific errors
            const geminiError = this.handleApiError(error);
            if (geminiError.type === GeminiErrorType.API_INVALID_RESPONSE) {
                geminiError.type = GeminiErrorType.IMAGE_GENERATION_FAILED;
                geminiError.message = 'Failed to generate image: ' + geminiError.message;
            }
            throw geminiError;
        }
    }

    /**
     * Build a prompt for image generation based on the word and its context
     */
    private buildImageGenerationPrompt(word: string, definition?: string): string {
        let prompt = `Create an educational, clear, and visually appealing illustration for the English word "${word}".`;

        if (definition) {
            // Extract key concepts from definition for better image context
            const keyContext = this.extractKeyConceptsFromDefinition(definition);
            if (keyContext) {
                prompt += ` Context: ${keyContext}.`;
            }
        }

        prompt += ` 

Requirements:
- The image should be educational and suitable for language learning
- Use clear, simple visual elements that directly relate to the word's meaning
- Avoid text or words in the image
- Use bright, engaging colors
- Make it suitable for all ages
- Focus on the most common or primary meaning of the word
- Style should be clean and modern, like an educational illustration

The image should help someone understand and remember the meaning of "${word}" visually.`;

        return prompt;
    }

    /**
     * Extract key concepts from a word definition to improve image generation
     */
    private extractKeyConceptsFromDefinition(definition: string): string | null {
        try {
            // Look for the main definition section
            const definitionMatch = definition.match(/\*\*Definition\*\*:?\s*([^\n\*]+)/i);
            if (definitionMatch) {
                return definitionMatch[1].trim();
            }

            // Fallback: look for the first substantial sentence
            const sentences = definition.split(/[.!?]+/);
            for (const sentence of sentences) {
                const cleaned = sentence.trim();
                if (cleaned.length > 20 && !cleaned.toLowerCase().includes('definition')) {
                    return cleaned;
                }
            }

            return null;
        } catch (error) {
            log.warn('Error extracting key concepts from definition:', error);
            return null;
        }
    }

    /**
     * Extract base64 image data from Gemini API response
     */
    private extractImageData(response: any): string | null {
        try {
            // Navigate the response structure to find image data
            const candidates = response.candidates;
            if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
                log.error('No candidates found in image generation response');
                return null;
            }

            const candidate = candidates[0];
            if (!candidate.content || !candidate.content.parts) {
                log.error('No content parts found in image generation response');
                return null;
            }

            // Look for inline data in the parts
            for (const part of candidate.content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    const imageData = part.inlineData.data;

                    // Validate base64 data
                    if (this.isValidBase64(imageData)) {
                        log.info(`Extracted image data: ${mimeType}, size: ${imageData.length} chars`);
                        return `data:${mimeType};base64,${imageData}`;
                    } else {
                        log.error('Invalid base64 image data received');
                        return null;
                    }
                }
            }

            log.error('No inline image data found in response parts');
            return null;

        } catch (error) {
            log.error('Error extracting image data from response:', error);
            return null;
        }
    }

    /**
     * Validate if a string is valid base64
     */
    private isValidBase64(str: string): boolean {
        try {
            if (!str || typeof str !== 'string') {
                return false;
            }

            // Basic base64 pattern check
            const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
            if (!base64Pattern.test(str)) {
                return false;
            }

            // Check if length is valid (must be multiple of 4)
            if (str.length % 4 !== 0) {
                return false;
            }

            // Try to decode to verify it's valid base64
            Buffer.from(str, 'base64');
            return true;

        } catch (error) {
            return false;
        }
    }

    /**
     * Generate both word definition and image in a single call
     * @param word - The English word to process
     * @returns Promise<{definition: string, imageUrl: string | null}>
     */
    public async getWordDefinitionWithImage(word: string): Promise<{
        definition: string;
        imageUrl: string | null;
    }> {
        try {
            log.info(`Getting complete word information for: ${word}`);

            // Get definition first
            const definition = await this.getWordDefinition(word);

            let imageUrl: string | null = null;

            try {
                // Try to generate image (don't fail the whole operation if image fails)
                imageUrl = await this.generateWordImage(word, definition);
            } catch (imageError) {
                log.warn(`Image generation failed for word "${word}":`, imageError);
                // Continue without image - this is not a critical failure
            }

            return {
                definition,
                imageUrl
            };

        } catch (error) {
            // If definition fails, the whole operation fails
            throw error;
        }
    }
}