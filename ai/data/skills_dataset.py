# ai/data/skills_dataset.py
# Why this file exists: A predefined list of skills the NLP extractor
# looks for in resumes and job descriptions. Centralizing it here means
# you can add new skills in one place and every part of the pipeline
# benefits automatically.
# How it connects: Imported by the skill extractor module. Skills are
# normalized to lowercase for case-insensitive matching.

PROGRAMMING_LANGUAGES = [
    "python", "javascript", "typescript", "java", "c", "c++", "c#",
    "go", "rust", "swift", "kotlin", "ruby", "php", "scala", "r",
    "dart", "perl", "matlab", "bash", "shell", "powershell", "sql",
    "html", "css", "sass", "less"
]

WEB_FRAMEWORKS = [
    "react", "angular", "vue", "svelte", "next.js", "nuxt.js",
    "express", "express.js", "fastapi", "flask", "django", "spring",
    "spring boot", "laravel", "rails", "ruby on rails", "asp.net",
    "node.js", "deno", "nestjs", "gatsby", "remix"
]

DATABASES = [
    "mongodb", "postgresql", "mysql", "sqlite", "redis", "elasticsearch",
    "cassandra", "dynamodb", "firebase", "supabase", "oracle", "mssql",
    "mariadb", "neo4j", "influxdb", "couchdb"
]

CLOUD_DEVOPS = [
    "aws", "azure", "gcp", "google cloud", "docker", "kubernetes",
    "terraform", "ansible", "jenkins", "github actions", "gitlab ci",
    "circleci", "travis ci", "nginx", "apache", "linux", "unix",
    "heroku", "vercel", "netlify", "cloudflare", "kafka", "rabbitmq"
]

AI_ML = [
    "machine learning", "deep learning", "neural networks", "nlp",
    "natural language processing", "computer vision", "tensorflow",
    "pytorch", "keras", "scikit-learn", "pandas", "numpy", "matplotlib",
    "seaborn", "opencv", "hugging face", "transformers", "bert", "gpt",
    "llm", "reinforcement learning", "data science", "data analysis",
    "statistics", "regression", "classification", "clustering",
    "random forest", "xgboost", "spark", "hadoop"
]

MOBILE = [
    "android", "ios", "react native", "flutter", "swift", "kotlin",
    "xamarin", "ionic", "cordova"
]

TOOLS = [
    "git", "github", "gitlab", "bitbucket", "jira", "confluence",
    "slack", "figma", "postman", "swagger", "vs code", "intellij",
    "eclipse", "xcode", "android studio", "linux", "windows", "macos",
    "webpack", "vite", "babel", "eslint", "prettier"
]

SOFT_SKILLS = [
    "leadership", "communication", "teamwork", "problem solving",
    "critical thinking", "time management", "agile", "scrum",
    "project management", "mentoring", "collaboration"
]

SECURITY = [
    "cybersecurity", "ethical hacking", "penetration testing",
    "owasp", "ssl", "tls", "oauth", "jwt", "cryptography",
    "firewall", "vpn", "siem"
]

# Flat combined list — used for fast lookup
ALL_SKILLS = list(set(
    [s.lower() for s in (
        PROGRAMMING_LANGUAGES + WEB_FRAMEWORKS + DATABASES +
        CLOUD_DEVOPS + AI_ML + MOBILE + TOOLS + SOFT_SKILLS + SECURITY
    )]
))

# Grouped dict — used when we want category-aware results
SKILLS_BY_CATEGORY = {
    "programming_languages": PROGRAMMING_LANGUAGES,
    "web_frameworks": WEB_FRAMEWORKS,
    "databases": DATABASES,
    "cloud_devops": CLOUD_DEVOPS,
    "ai_ml": AI_ML,
    "mobile": MOBILE,
    "tools": TOOLS,
    "soft_skills": SOFT_SKILLS,
    "security": SECURITY,
}