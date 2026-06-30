# AI Resume Screening & Interview Assistant – Architecture

## Project Overview

The AI Resume Screening & Interview Assistant is a full-stack web application that automates the candidate screening process.

Recruiters can upload resumes and compare them with a job description using Natural Language Processing (NLP) and Machine Learning techniques. The system extracts structured information from resumes, computes semantic similarity between resumes and job descriptions using sentence embeddings, ranks candidates, and generates interview questions based on the candidate's profile.

---

# System Architecture

```
                        +-----------------------+
                        |      Frontend         |
                        | HTML / CSS / JS       |
                        +----------+------------+
                                   |
                             HTTP Requests
                                   |
                                   ▼
                    +-----------------------------+
                    |     Express.js Backend       |
                    | Authentication              |
                    | Resume Upload              |
                    | REST APIs                  |
                    | Business Logic             |
                    +-------------+--------------+
                                  |
                  +---------------+----------------+
                  |                                |
                  ▼                                ▼
        +------------------+            +------------------+
        |     MongoDB      |            |   Python AI      |
        | Users            |            | Resume Parsing   |
        | Candidates       |            | NLP Pipeline     |
        | Job Descriptions |            | Resume Matching  |
        | Match Scores     |            | Question Gen.    |
        +------------------+            +------------------+
```

---

# Technology Stack

## Frontend

- HTML5
- CSS3
- JavaScript

## Backend

- Node.js
- Express.js
- JWT Authentication
- Multer

## Database

- MongoDB
- Mongoose

## AI Module

- Python
- PyMuPDF
- NLTK
- Sentence Transformers
- Scikit-Learn
- NumPy
- Pandas

---

# Folder Structure

```
AI-Resume-Screening/

│
├── client/
│
├── server/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   ├── utils/
│   └── uploads/
│
├── ai/
│   ├── embeddings/
│   ├── interview/
│   ├── nlp/
│   ├── utils/
│   └── data/
│
└── docs/
```

---

# Request Flow

## Resume Upload

```
Recruiter

↓

Upload Resume

↓

Express API

↓

Multer

↓

PDF Stored

↓

Candidate Created

↓

Background AI Analysis

↓

MongoDB Updated

↓

Frontend Dashboard
```

---

# AI Processing Pipeline

```
Resume PDF

↓

PyMuPDF

↓

Raw Text Extraction

↓

Regex Extraction

↓

Text Cleaning

↓

Section Detection

↓

Skill Extraction

↓

Education Parsing

↓

Experience Parsing

↓

Project Parsing

↓

Structured Resume JSON
```

---

# Resume Matching Pipeline

```
Parsed Resume

+

Job Description

↓

Skill Extraction

↓

Sentence Embeddings

↓

Cosine Similarity

↓

Experience Evaluation

↓

Education Evaluation

↓

Weighted Score Calculation

↓

Candidate Ranking
```

---

# Node.js ↔ Python Communication

The backend and AI module communicate using child processes.

1. Express receives an HTTP request.
2. The backend starts a Python process.
3. JSON input is sent to Python through Standard Input (stdin).
4. Python performs the requested AI task.
5. Python returns JSON through Standard Output (stdout).
6. Express processes the response and updates MongoDB.

This architecture keeps the AI module independent from the backend and allows the AI logic to evolve without changing the REST API.

---

# Database Overview

The application stores data in three primary collections.

## Users

Stores recruiter accounts and authentication information.

## Job Descriptions

Stores job details, extracted skills, and embeddings.

## Candidates

Stores uploaded resume metadata, parsed information, match scores, recruiter notes, interview questions, and processing status.

---

# Security

- JWT Authentication
- Password hashing using bcrypt
- Environment variables
- File type validation
- File size validation
- Protected API routes
- Input validation
- Error handling

---

# Design Principles

- MVC Architecture
- Modular AI Pipeline
- Separation of Concerns
- Asynchronous Background Processing
- Reusable Services
- RESTful APIs
- Clean Code Practices

---

# Future Improvements

- Redis Queue for background jobs
- WebSocket-based live status updates
- LLM-powered interview question generation
- OCR support for scanned resumes
- Multi-language resume parsing
- Cloud deployment with Docker and Kubernetes
