import OpenAI from 'openai';
import type {
    ChatCompletionMessageParam,
    ChatCompletionCreateParamsStreaming,
    ChatCompletionCreateParamsNonStreaming,
} from 'openai/resources/chat/completions';
import * as dotenv from 'dotenv';
import log from 'electron-log';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

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
        public details?: unknown
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
    baseUrl: string;
    referer?: string;
    appTitle?: string;
}

/**
 * GeminiService class handles all interactions with Gemini models via OpenRouter API
 * Provides text generation and image generation capabilities
 */
export class GeminiService {
    private config: GeminiConfig | null = null;
    private isInitialized = false;
    private client: OpenAI | null = null;

    constructor() {
        this.loadEnvironmentConfig();
        this.initializeService();
    }

    /**
     * Load environment variables from known locations in both dev and packaged builds
     */
    private loadEnvironmentConfig(): void {
        const candidatePaths = Array.from(
            new Set(
                [
                    // Packaged app: .env copied to Resources via forge extraResource
                    path.join(process.resourcesPath, '.env'),
                    // Packaged app alternative: alongside executable
                    app?.isReady?.() ? path.join(path.dirname(app.getPath('exe')), '.env') : null,
                    // Dev build: project root
                    path.resolve(process.cwd(), '.env'),
                    // Fallback when running from compiled bundle
                    path.resolve(__dirname, '../../.env')
                ].filter((p): p is string => !!p)
            )
        );

        const foundPath = candidatePaths.find((envPath) => fs.existsSync(envPath));

        if (foundPath) {
            dotenv.config({ path: foundPath, override: false });
            log.info(`Loaded environment variables from ${foundPath}`);
        } else {
            log.warn('No .env file found in expected locations; relying on process environment variables');
        }
    }

    /**
     * Initialize the Gemini service with configuration from environment variables
     */
    private initializeService(): void {
        try {
            log.info('Initializing GeminiService...');

            const apiKey = process.env.OPENROUTER_API_KEY;
            const textModel = process.env.OPENROUTER_TEXT_MODEL || 'google/gemini-2.0-flash-001';
            const imageModel = process.env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.0-flash-001';
            const baseUrl = process.env.OPENROUTER_API_BASE_URL;
            const referer = process.env.OPENROUTER_REFERRER;
            const appTitle = process.env.OPENROUTER_TITLE;

            if (!apiKey) {
                log.error('OpenRouter API key is missing or not configured');
                throw new GeminiError(
                    GeminiErrorType.API_KEY_MISSING,
                    'OpenRouter API key is missing. Please configure OPENROUTER_API_KEY in your .env file.'
                );
            }

            this.config = {
                apiKey,
                textModel,
                imageModel,
                baseUrl,
                referer,
                appTitle
            };

            const defaultHeaders: Record<string, string> = {};
            if (referer) {
                defaultHeaders['HTTP-Referer'] = referer;
            }
            if (appTitle) {
                defaultHeaders['X-Title'] = appTitle;
            }

            this.client = new OpenAI({
                apiKey,
                baseURL: baseUrl,
                defaultHeaders,
            });

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
            !!this.config.apiKey &&
            !!this.config.textModel &&
            !!this.config.imageModel &&
            !!this.config.baseUrl &&
            this.client !== null;
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

        if (!this.config.apiKey) {
            errors.push('API key is missing or using placeholder value');
        }

        if (!this.config.textModel) {
            errors.push('Text model configuration is missing');
        }

        if (!this.config.imageModel) {
            errors.push('Image model configuration is missing');
        }

        if (!this.config.baseUrl) {
            errors.push('Base URL configuration is missing');
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
            referer: this.config.referer,
            appTitle: this.config.appTitle,
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

            const response = await this.callChatCompletion({
                prompt: 'Hello',
                stream: false,
                maxTokens: 100 // Small limit for connection test
            });

            if (response && response.trim().length > 0) {
                log.info('Gemini API connection test successful');
                return { success: true };
            }

            log.error('Gemini API connection test failed: No response text');
            return {
                success: false,
                error: 'Invalid response from API'
            };

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
    private handleApiError(error: unknown): GeminiError {
        log.error('Gemini API error:', error);

        const message =
            error instanceof Error
                ? error.message
                : typeof error === 'string'
                    ? error
                    : typeof (error as { message?: unknown })?.message === 'string'
                        ? (error as { message: string }).message
                        : '';

        const errorWithCode = (typeof error === 'object' && error !== null
            ? (error as { code?: string })
            : {}) as { code?: string };

        // Check for specific error types
        if (message.includes('API_KEY')) {
            return new GeminiError(
                GeminiErrorType.API_KEY_MISSING,
                'Invalid or missing API key',
                error
            );
        }

        if (message.includes('quota') || message.includes('rate limit')) {
            return new GeminiError(
                GeminiErrorType.API_RATE_LIMIT,
                'API rate limit exceeded. Please try again later.',
                error
            );
        }

        if (errorWithCode.code === 'NETWORK_ERROR' || message.includes('network')) {
            return new GeminiError(
                GeminiErrorType.API_NETWORK_ERROR,
                'Network error occurred. Please check your internet connection.',
                error
            );
        }

        // Default to generic API error
        return new GeminiError(
            GeminiErrorType.API_INVALID_RESPONSE,
            message || 'An error occurred while calling the Gemini API',
            error
        );
    }

    /**
     * Get the OpenAI client (configured for OpenRouter)
     */
    private getClient(): OpenAI {
        if (!this.client) {
            throw new GeminiError(
                GeminiErrorType.CONFIGURATION_ERROR,
                'Gemini service client is not initialized'
            );
        }
        return this.client;
    }

    /**
     * Extract text content from a chat completion response
     */
    private extractContentText(content: unknown): string {
        if (typeof content === 'string') {
            return content;
        }

        if (Array.isArray(content)) {
            return content
                .map((part) => {
                    if (typeof part === 'string') return part;
                    if (part && typeof part === 'object' && 'text' in part && typeof (part as { text?: unknown }).text === 'string') {
                        return (part as { text: string }).text;
                    }
                    if (part && typeof part === 'object' && 'content' in part && typeof (part as { content?: unknown }).content === 'string') {
                        return (part as { content: string }).content;
                    }
                    return '';
                })
                .join('');
        }

        if (content && typeof content === 'object' && 'text' in content && typeof (content as { text?: unknown }).text === 'string') {
            return (content as { text: string }).text;
        }

        return '';
    }

    /**
     * Call the OpenRouter chat completions API
     */
    private async callChatCompletion(options: {
        prompt: string;
        stream: boolean;
        maxTokens?: number;
        onChunk?: (chunk: string) => void;
    }): Promise<string> {
        if (!this.config) {
            throw new GeminiError(
                GeminiErrorType.CONFIGURATION_ERROR,
                'Gemini service is not properly configured'
            );
        }

        const client = this.getClient();
        const messages: ChatCompletionMessageParam[] = [
            {
                role: 'user',
                content: options.prompt
            }
        ];

        // Default to 4096 tokens, which is reasonable for word definitions
        // This prevents the API from using the model's maximum (e.g., 64000)
        const maxTokens = options.maxTokens;

        // OpenRouter provider routing configuration
        // See: https://openrouter.ai/docs/features/provider-routing
        // We spread provider directly into the request body using type assertion
        // because OpenRouter extends the OpenAI API with additional fields
        const providerConfig = {
            provider: {
                only: ['google-ai-studio'],
                allow_fallbacks: false,
            },
        };

        if (options.stream) {
            const streamParams = {
                model: this.config.textModel,
                messages,
                max_tokens: maxTokens,
                stream: true as const,
                ...providerConfig,
            };
            const stream = await client.chat.completions.create(
                streamParams as ChatCompletionCreateParamsStreaming
            );

            let fullText = '';
            for await (const chunk of stream) {
                const delta = chunk?.choices?.[0]?.delta?.content;
                const deltaText = this.extractContentText(delta);
                if (deltaText) {
                    fullText += deltaText;
                    if (options.onChunk) {
                        options.onChunk(fullText);
                    }
                }
            }

            if (!fullText) {
                throw new GeminiError(
                    GeminiErrorType.API_INVALID_RESPONSE,
                    'Empty response received from Gemini API'
                );
            }

            return fullText;
        }

        const nonStreamParams = {
            model: this.config.textModel,
            messages,
            max_tokens: maxTokens,
            stream: false as const,
            ...providerConfig,
        };
        const completion = await client.chat.completions.create(
            nonStreamParams as ChatCompletionCreateParamsNonStreaming
        );

        const content = completion?.choices?.[0]?.message?.content;
        const text = this.extractContentText(content);
        if (!text) {
            throw new GeminiError(
                GeminiErrorType.API_INVALID_RESPONSE,
                'Empty response received from Gemini API'
            );
        }

        return text;
    }

    /**
     * Attempt to parse an error response body
     */

    /**
     * Get detailed English definition and explanation for a word with streaming support
     * @param word - The English word to look up
     * @param onChunk - Callback function for streaming chunks
     * @returns Promise<string> - Formatted definition and explanation
     */
    public async getWordDefinitionStream(
        word: string, 
        onChunk: (chunk: string) => void
    ): Promise<string> {
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
            log.info(`Looking up word definition with streaming for: ${cleanWord}`);

            // Create a comprehensive prompt for word definition
            const prompt = this.buildWordDefinitionPrompt(cleanWord);

            const fullText = await this.callChatCompletion({
                prompt,
                stream: true,
                onChunk
            });

            const formattedDefinition = this.formatWordDefinition(fullText, cleanWord);
            log.info(`Successfully retrieved streaming definition for word: ${cleanWord}`);

            return formattedDefinition;

        } catch (error) {
            if (error instanceof GeminiError) {
                throw error;
            }
            throw this.handleApiError(error);
        }
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

            const text = await this.callChatCompletion({
                prompt,
                stream: false
            });

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
        text = text.replace(/^\s*(\d+\.|\*|-)\s*/gm, '$1 ');

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
        const wordPattern = /^[a-zA-Z-']+$/;
        if (!wordPattern.test(trimmed)) {
            return { isValid: false, error: 'Word contains invalid characters' };
        }

        return { isValid: true };
    }

    /**
     * Generate an educational image related to a word
     * @param word - The English word to generate an image for
     * @param definition - Optional definition context to improve image generation
     * @returns Promise<string> - Base64 encoded image data URL
     */
    public async generateWordImage(word: string): Promise<string> {
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
            const prompt = this.buildImageGenerationPrompt(cleanWord);
            
            const client = this.getClient();
            
            // Use OpenRouter's chat completions API with modalities for image generation
            // See: https://openrouter.ai/docs/guides/overview/multimodal/image-generation
            // Note: max_tokens is set low (256) since we primarily want the image output,
            // not extensive text. This also prevents exceeding credit limits on paid accounts.
            const imageParams = {
                model: this.config!.imageModel,
                messages: [
                    {
                        role: 'user' as const,
                        content: prompt
                    }
                ],
                max_tokens: 256,
                stream: false as const,
                // OpenRouter extensions: modalities and provider routing
                modalities: ['image', 'text'],
                provider: {
                    only: ['google-ai-studio'],
                    allow_fallbacks: false,
                },
            };
            const response = await client.chat.completions.create(
                imageParams as ChatCompletionCreateParamsNonStreaming
            );
            
            // Extract image data from OpenRouter response format
            const imageUrl = this.extractImageFromChatResponse(response);
            
            if (!imageUrl) {
                throw new GeminiError(
                    GeminiErrorType.IMAGE_GENERATION_FAILED,
                    'No image data found in API response'
                );
            }

            log.info(`Successfully generated image for word: ${cleanWord}`);
            return imageUrl;

        } catch (error) {
            if (error instanceof GeminiError) {
                throw error;
            }

            // Handle image generation specific errors
            const geminiError = this.handleApiError(error);
            geminiError.type = GeminiErrorType.IMAGE_GENERATION_FAILED;
            geminiError.message = 'Image generation failed: ' + geminiError.message;
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
            const definitionMatch = definition.match(/\*\*Definition\*\*:?\s*([^\n*]+)/i);
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
     * Extract image data from OpenRouter chat completions response
     * OpenRouter returns images in message.images array with image_url.url format
     * See: https://openrouter.ai/docs/guides/overview/multimodal/image-generation
     */
    private extractImageFromChatResponse(response: unknown): string | null {
        try {
            // OpenRouter chat completions response format for image generation
            interface OpenRouterImageResponse {
                choices?: Array<{
                    message?: {
                        role?: string;
                        content?: string;
                        images?: Array<{
                            type?: string;
                            image_url?: {
                                url?: string;
                            };
                        }>;
                    };
                }>;
            }

            const chatResponse = response as OpenRouterImageResponse;
            const message = chatResponse?.choices?.[0]?.message;

            if (!message) {
                log.error('No message found in chat completions response');
                return null;
            }

            // Check for images in the response
            if (message.images && message.images.length > 0) {
                const firstImage = message.images[0];
                const imageUrl = firstImage?.image_url?.url;

                if (imageUrl) {
                    log.info(`Extracted image from chat response, URL length: ${imageUrl.length} chars`);
                    // OpenRouter returns base64 data URLs directly (e.g., "data:image/png;base64,...")
                    return imageUrl;
                }
            }

            log.error('No images found in chat completions response');
            log.debug('Response structure:', JSON.stringify(chatResponse, null, 2));
            return null;

        } catch (error) {
            log.error('Error extracting image from chat response:', error);
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
                imageUrl = await this.generateWordImage(word);
            } catch (imageError) {
                log.warn(`Image generation failed for word "${word}":`, imageError);
                // Continue without image - this is not a critical failure
            }

            return {
                definition,
                imageUrl
            };

        } catch (error) {
            log.error('Error in getWordDefinitionWithImage:', error);
            // If definition fails, the whole operation fails
            throw error;
        }
    }
}
