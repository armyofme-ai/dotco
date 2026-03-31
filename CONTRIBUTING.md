# Contributing to Dotco

Thanks for your interest in contributing! Here's how you can help.

## Reporting Bugs

Open a [GitHub issue](https://github.com/dotco-ai/dotco/issues) with:

- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Node.js version, browser)

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b my-feature`)
3. Make your changes
4. Ensure linting passes (`npm run lint`)
5. Commit with a descriptive message
6. Push to your fork and open a Pull Request

### PR Guidelines

- Keep PRs focused on a single change
- Include a description of what changed and why
- Add tests for new functionality when possible
- Update documentation if behavior changes

## Development Setup

See the [README](README.md) for full setup instructions. The short version:

```bash
git clone https://github.com/dotco-ai/dotco.git
cd dotco
npm install
docker compose up -d
cp .env.example .env
npx prisma migrate deploy
npm run dev
```

## Code Style

- TypeScript throughout
- Prettier for formatting
- ESLint for linting (`npm run lint`)
- Follow existing patterns in the codebase

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
