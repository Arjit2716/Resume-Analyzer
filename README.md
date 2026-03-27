"# Resume Analyzer Web App

A modern web application for AI-powered resume analysis using FastAPI, featuring job description matching, skill extraction, resume scoring, and comparison capabilities.

## Features

- 📄 **Resume Upload**: Upload PDF resumes for analysis
- 🎯 **JD Match Analysis**: Compare resumes against job descriptions
- 🛠️ **Skill Extraction**: Automatically extract technical and soft skills
- ⭐ **Resume Scoring**: Get comprehensive resume scores
- 💡 **Improvement Suggestions**: Receive personalized recommendations
- ⚔️ **Resume Comparison**: Compare two resumes side-by-side
- 📊 **Detailed Reports**: Download comprehensive analysis reports

## Tech Stack

- **Backend**: FastAPI (Python)
- **AI/ML**: Groq API, Anthropic Claude, Sentence Transformers, FAISS
- **Frontend**: HTML5, Bootstrap 5, Jinja2 templates
- **File Processing**: PDF text extraction with pdfplumber

## Installation

1. **Clone or download the project**
   ```bash
   cd resume-analyzer
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables**

   Copy the example environment file and fill in your API keys:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your API keys:
   ```bash
   GROQ_API_KEY=your_actual_groq_api_key
   ANTHROPIC_API_KEY=your_actual_anthropic_api_key
   ```

   **Get API Keys:**
   - **Groq**: Sign up at [groq.com](https://groq.com) and get your API key
   - **Anthropic**: Sign up at [anthropic.com](https://anthropic.com) and get your API key

## Running the Application

Start the web server:
```bash
python app.py
```

Or use uvicorn directly:
```bash
uvicorn app:app --host 0.0.0.0 --port 8001 --reload
```

Open your browser and go to: http://localhost:8001

## Usage

### Single Resume Analysis
1. Upload a PDF resume
2. Paste the job description
3. Click "Analyze Resume"
4. View detailed analysis results
5. Download the full report

### Resume Comparison
1. Upload two PDF resumes
2. Paste the job description
3. Click "Compare Resumes"
4. See side-by-side comparison with recommendations

## API Endpoints

- `GET /` - Home page
- `POST /analyze` - Analyze single resume
- `POST /compare` - Compare two resumes

## Project Structure

```
resume-analyzer/
├── app.py                 # FastAPI web application
├── main.py               # Original CLI version
├── ingest.py             # PDF processing and indexing
├── analyze.py            # AI analysis functions
├── compare.py            # Resume comparison logic
├── report.py             # Report generation
├── requirements.txt      # Python dependencies
├── templates/            # HTML templates
│   ├── index.html
│   ├── results.html
│   ├── comparison.html
│   └── error.html
├── uploads/              # Uploaded files and reports
└── static/               # Static assets
```

## Security Notes

- API keys are currently hardcoded in the code files
- For production deployment, move API keys to environment variables
- Consider implementing user authentication for production use
- Uploaded files are stored temporarily - implement cleanup for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source. Feel free to use and modify as needed." 
"# resume-analyzer" 
