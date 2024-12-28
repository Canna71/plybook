interface LoadCSSOptions {
    id?: string;        // Optional ID for the link element
    media?: string;     // Optional media query
    disabled?: boolean; // Optional initial disabled state
  }
  
  export class CSSLoader {
    private loadedStyles: Map<string, HTMLLinkElement> = new Map();
  
    async loadCSS(url: string, options: LoadCSSOptions = {}): Promise<HTMLLinkElement> {
      // Return existing if already loaded
      if (this.loadedStyles.has(url)) {
        return this.loadedStyles.get(url)!;
      }
  
      return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
  
        // Apply options
        if (options.id) link.id = options.id;
        if (options.media) link.media = options.media;
        if (options.disabled) link.disabled = true;
  
        link.onload = () => {
          this.loadedStyles.set(url, link);
          resolve(link);
        };
  
        link.onerror = () => {
          reject(new Error(`Failed to load CSS: ${url}`));
        };
  
        document.head.appendChild(link);
      });
    }
  
    unloadCSS(url: string): boolean {
      const link = this.loadedStyles.get(url);
      if (link) {
        link.remove();
        this.loadedStyles.delete(url);
        return true;
      }
      return false;
    }
  
    toggleCSS(url: string, enabled: boolean): void {
      const link = this.loadedStyles.get(url);
      if (link) {
        link.disabled = !enabled;
      }
    }
  }
  /*
  // Usage example:
  const cssLoader = new CSSLoader();
  
  // Load a CSS file
  try {
    await cssLoader.loadCSS('https://cdn.example.com/style.css', {
      id: 'dynamic-style',
      media: 'screen'
    });
    console.log('CSS loaded successfully');
  } catch (error) {
    console.error('Failed to load CSS:', error);
  }
  
  // Unload when no longer needed
  cssLoader.unloadCSS('https://cdn.example.com/style.css');
  */