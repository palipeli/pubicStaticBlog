// Cloudflare Worker Script for Static SPA with Aggressive Caching
// This worker sets explicit Cache-Control headers for JavaScript files
// while keeping HTML entry points as no-cache for fresh content delivery

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle requests based on file type
    let response;
    
    // Check if request is for HTML entry points (no-cache)
    if (isHtmlEntry(pathname)) {
      response = await fetch(request);
      
      // Clone response to modify headers
      const newResponse = new Response(response.body, response);
      
      // Set no-cache headers for HTML entry points
      newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      newResponse.headers.set('Pragma', 'no-cache');
      newResponse.headers.set('Expires', '0');
      
      // Add CDN cache bypass for HTML
      newResponse.headers.set('CF-Cache-Status', 'BYPASS');
      
      return newResponse;
    }
    
    // Check if request is for JavaScript files (aggressive caching)
    if (isJavaScriptFile(pathname)) {
      response = await fetch(request);
      
      // Only modify headers for successful responses
      if (response.ok) {
        const newResponse = new Response(response.body, response);
        
        // Set aggressive caching headers for JavaScript files
        // Cache for 1 year (31536000 seconds) with immutable flag
        newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        
        // Enable Cloudflare CDN caching
        newResponse.headers.set('CDN-Cache-Control', 'public, max-age=31536000, immutable');
        
        // Set far-future expires header
        const farFutureDate = new Date();
        farFutureDate.setFullYear(farFutureDate.getFullYear() + 1);
        newResponse.headers.set('Expires', farFutureDate.toUTCString());
        
        return newResponse;
      }
      
      return response;
    }
    
    // Check if request is for CSS files (aggressive caching)
    if (isCssFile(pathname)) {
      response = await fetch(request);
      
      if (response.ok) {
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        newResponse.headers.set('CDN-Cache-Control', 'public, max-age=31536000, immutable');
        return newResponse;
      }
      
      return response;
    }
    
    // Check if request is for media/image files (aggressive caching)
    if (isMediaFile(pathname)) {
      response = await fetch(request);
      
      if (response.ok) {
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        newResponse.headers.set('CDN-Cache-Control', 'public, max-age=31536000, immutable');
        return newResponse;
      }
      
      return response;
    }
    
    // Check if request is for JSON data files (moderate caching)
    if (isJsonFile(pathname)) {
      response = await fetch(request);
      
      if (response.ok) {
        const newResponse = new Response(response.body, response);
        // Cache JSON for 1 hour with revalidation
        newResponse.headers.set('Cache-Control', 'public, max-age=3600, must-revalidate');
        return newResponse;
      }
      
      return response;
    }
    
    // Default: pass through without modification
    return fetch(request);
  }
};

// Helper function to identify HTML entry points
function isHtmlEntry(pathname) {
  // Root path or explicit .html files are considered entry points
  if (pathname === '/' || pathname === '') {
    return true;
  }
  
  // Check for .html extension
  if (pathname.endsWith('.html')) {
    return true;
  }
  
  // Explicitly handle index.html
  if (pathname.endsWith('/index.html')) {
    return true;
  }
  
  return false;
}

// Helper function to identify JavaScript files
function isJavaScriptFile(pathname) {
  // Check for .js extension
  if (pathname.endsWith('.js')) {
    return true;
  }
  
  // Check for .mjs extension (ES modules)
  if (pathname.endsWith('.mjs')) {
    return true;
  }
  
  // Check for files in /js/ directory
  if (pathname.includes('/js/')) {
    return true;
  }
  
  return false;
}

// Helper function to identify CSS files
function isCssFile(pathname) {
  return pathname.endsWith('.css');
}

// Helper function to identify media files
function isMediaFile(pathname) {
  const mediaExtensions = [
    '.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg', 
    '.ico', '.mp4', '.webm', '.mp3', '.wav', '.woff', 
    '.woff2', '.ttf', '.eot'
  ];
  
  return mediaExtensions.some(ext => pathname.endsWith(ext));
}

// Helper function to identify JSON files
function isJsonFile(pathname) {
  return pathname.endsWith('.json');
}
