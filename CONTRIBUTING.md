# Contributing to SafeShamba

Thank you for your interest in contributing! This document outlines the process for contributing to the project.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork
3. **Install** dependencies
   ```bash
   npm install
   cd app && npm install
   ```
4. **Run** tests
   ```bash
   forge test
   ```

## Development Setup

### Smart Contracts
```bash
# Build
forge build

# Test
forge test

# Format
forge fmt

# Lint
npx solhint 'contracts/**/*.sol'
```

### Frontend
```bash
cd app
npm run dev    # Start dev server
npm run build  # Build for production
```

## Pull Request Process

1. Create a feature branch
2. Make your changes
3. Ensure all tests pass
4. Submit a pull request with a clear description

## Coding Standards

- Follow existing code style
- Add comments for complex logic
- Write tests for new features
- Update documentation as needed

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---
*Thanks for contributing to SafeShamba!*