# SnakeWatch - Development Guide

## Commands
- **Start bot**: `npm start`
- **Run tests**: `npm test`
- **Run single test**: `npm test -- -t "test name"` 
- **Debug**: Add console.log statements for debugging (no formal linting)

## Code Style
- **Format**: Modern JavaScript with ES modules
- **Imports**: Use named imports/exports
- **Architecture**: Event-driven with specialized handlers
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Functions**: Prefer arrow functions with destructured parameters
- **Async**: Use async/await for promises
- **Error handling**: Try/catch blocks for operations that may fail
- **Performance**: Memoize expensive operations where appropriate
- **Types**: No formal typing system, use JSDoc when needed
- **Comments**: Add comments for complex logic or non-obvious behavior

## Project Structure
- **src/handlers/**: Specialized handlers for different blockchain events
- **src/utils/**: Shared utility functions
- **src/resources/**: ABI definitions and other resources
- **tests/**: Jest test files