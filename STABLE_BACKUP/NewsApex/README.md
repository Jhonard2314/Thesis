# NewsApex 

### Prerequisites

- Node.js 18.x or higher
- A free API key from [NewsAPI.org](https://newsapi.org/)

### Installation

1. Clone the repository or navigate to the project directory:

```bash
cd news_apex
```

2. Install dependencies:

```bash
npm install
```

3. Set up your environment variables:

   - Copy `.env.local` and add your NewsAPI key:

```
NEXT_PUBLIC_NEWS_API_KEY=your_actual_api_key_here
```

4. Get your free API key:
   - Visit [https://newsapi.org/](https://newsapi.org/)
   - Sign up for a free account
   - Copy your API key
   - Paste it in the `.env.local` file

5. Run the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

To build for production:

```bash
npm run build
npm start
```

Deploy to Vercel:

```bash
npx vercel
```

Make sure to add your `NEXT_PUBLIC_NEWS_API_KEY` environment variable in your Vercel project settings.

## Limitations

- NewsAPI free tier has limitations (500 requests/day for development)
- Some news sources may block image loading from external domains
- Historical news data is limited on the free tier

## License

MIT

## Support

For issues or questions, please visit [NewsAPI Documentation](https://newsapi.org/docs)
