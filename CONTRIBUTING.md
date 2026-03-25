# Contributing to LakehousePlatform

We welcome contributions from the community! Here is how you can help.

## Getting Started

1. Fork the repository
2. Clone your fork: \`git clone https://github.com/YOUR_USERNAME/lakehouse-platform\`
3. Create a feature branch: \`git checkout -b feature/your-feature\`
4. Set up the development environment:

\`\`\`bash
# Python backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install ruff mypy black isort pytest pytest-asyncio

# Frontend
cd frontend
npm install

# Start services
docker-compose -f docker/docker-compose.yml up -d postgres redis minio
\`\`\`

## Development Workflow

1. Make your changes
2. Run tests: \`pytest tests/\`
3. Run linting: \`ruff check . && black --check . && isort --check-only .\`
4. Commit with descriptive messages
5. Push to your fork and submit a Pull Request

## Code Style

- Python: Black formatter, Ruff linter, isort for imports
- TypeScript/React: ESLint + Prettier
- Terraform: terraform fmt

## Architecture Decisions

Major architecture changes should be proposed via GitHub Discussions first.

## Reporting Issues

Use GitHub Issues. Include:
- Steps to reproduce
- Expected vs actual behavior
- Environment info (OS, Python version, etc.)
- Logs/screenshots if applicable

## License

By contributing, you agree your contributions will be licensed under Apache 2.0.
