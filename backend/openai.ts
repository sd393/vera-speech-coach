import OpenAI from 'openai'

let client: OpenAI | null = null

export function openai(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY environment variable is not set. ' +
        'Create a .env.local file with your key (see .env.example).'
      )
    }
    client = new OpenAI({ apiKey })
  }
  return client
}
