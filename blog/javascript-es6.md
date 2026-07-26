---
title: "JavaScript ES6+ Features You Should Know"
date: "Dec 13, 2024"
category: "Technology"
icon: "⚡"
---

# JavaScript ES6+ Features You Should Know

Modern JavaScript has evolved significantly since ES6 (ECMAScript 2015). Let's explore the essential features that will make your code cleaner and more efficient.

## Arrow Functions

Arrow functions provide a concise syntax and lexical `this` binding:

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

Extract values from arrays and objects with ease:

```javascript
// Array destructuring
const [first, second, ...rest] = [1, 2, 3, 4, 5];

// Object destructuring
const { name, age, city = 'Unknown' } = user;

// Nested destructuring
const { user: { profile: { avatar } } } = data;
```

## Template Literals

String interpolation made simple:

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

The versatile `...` operator:

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

No more undefined checks:

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

Cleaner asynchronous code:

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

Import and export for better code organization:

```javascript
// math.js
export const PI = 3.14159;
export function add(a, b) { return a + b; }
export default class Calculator {}

// main.js
import Calculator, { PI, add } from './math.js';
```

## Optional Chaining & Nullish Coalescing

Safe property access and default values:

```javascript
// Optional chaining
const street = user?.address?.street ?? 'No address';

// Nullish coalescing
const count = itemCount ?? 0;
const name = userName || 'Anonymous'; // Still useful for empty strings
```

## Conclusion

These modern JavaScript features are now widely supported and should be part of every developer's toolkit. Start incorporating them into your projects today!

### Resources

- [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
- [ES6 Features](https://github.com/lukehoban/es6features)
- [Can I Use](https://caniuse.com/) - Check browser support

Keep coding! 💻
