---
title: "JavaScript ES6+ Features You Should Know"
date: "Dec 13, 2024"
category: "Technology"
icon: "⚡"
---

# JavaScript ES6+ Features You Should Know

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.

## Arrow Functions

Lorem ipsum dolor sit amet, consectetur adipiscing elit:

```javascript
// Traditional function
const add = function(a, b) {
    return a + b;
};

// Arrow function
const add = (a, b) => a + b;

// With object return
const createUser = (name, age) => ({ name, age });
```

## Destructuring Assignment

Lorem ipsum dolor sit amet, consectetur adipiscing elit:

```javascript
// Array destructuring
const [first, second, ...rest] = [1, 2, 3, 4, 5];

// Object destructuring
const { name, age, city = 'Unknown' } = user;

// Nested destructuring
const { user: { profile: { avatar } } } = data;
```

## Template Literals

Lorem ipsum dolor sit amet, consectetur adipiscing elit:

```javascript
const name = 'Alice';
const greeting = `Hello, ${name}! 
Welcome to our platform.`;

// Tagged templates
const highlight = (strings, ...values) => {
    // Custom processing
};
```

## Spread and Rest Operators

Lorem ipsum dolor sit amet, consectetur adipiscing elit:

```javascript
// Spread - expand iterables
const newArray = [...oldArray, newItem];
const newObj = { ...oldObj, newProp: value };

// Rest - collect remaining elements
function sum(...numbers) {
    return numbers.reduce((a, b) => a + b, 0);
}
```

## Default Parameters

Lorem ipsum dolor sit amet, consectetur adipiscing elit:

```javascript
function greet(name = 'Guest', greeting = 'Hello') {
    return `${greeting}, ${name}!`;
}

// Dynamic defaults
function fetch(url, options = {}) {
    const config = {
        method: 'GET',
        ...options
    };
}
```

## Async/Await

Lorem ipsum dolor sit amet, consectetur adipiscing elit:

```javascript
// Promise chain
fetch('/api/data')
    .then(res => res.json())
    .then(data => console.log(data));

// Async/await
async function getData() {
    try {
        const res = await fetch('/api/data');
        const data = await res.json();
        console.log(data);
    } catch (error) {
        console.error(error);
    }
}
```

## Modules

Lorem ipsum dolor sit amet, consectetur adipiscing elit:

```javascript
// math.js
export const PI = 3.14159;
export function add(a, b) { return a + b; }
export default class Calculator {}

// main.js
import Calculator, { PI, add } from './math.js';
```

## Optional Chaining & Nullish Coalescing

Lorem ipsum dolor sit amet, consectetur adipiscing elit:

```javascript
// Optional chaining
const street = user?.address?.street ?? 'No address';

// Nullish coalescing
const count = itemCount ?? 0;
const name = userName || 'Anonymous';
```

## Conclusion

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

### Resources

- [Lorem Ipsum](https://example.com/)
- [Dolor Sit](https://example.com/)
- [Amet Consectetur](https://example.com/)

Lorem ipsum dolor sit amet! 💻
