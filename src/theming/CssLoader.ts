interface LoadCSSOptions {
    id?: string;        // Optional ID for the link element
    media?: string;     // Optional media query
    disabled?: boolean; // Optional initial disabled state
  }
  
  export class CSSLoader {
    private loadedStyles: Map<string, HTMLLinkElement> = new Map();
  
     injectCSS(cssContent: string, id: string): HTMLStyleElement {
      const existingStyle = document.getElementById(id) as HTMLStyleElement;
      if (existingStyle) {
        existingStyle.remove();
      }

      const style = document.createElement('style');
      style.id = id;
      style.textContent = cssContent;
      document.head.appendChild(style);
      return style;
    }

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
          this.loadedStyles.set(options.id || url, link);
          resolve(link);
        };
  
        link.onerror = () => {
          reject(new Error(`Failed to load CSS: ${url}`));
        };
  
        document.head.appendChild(link);
      });
    }
  
    unloadCSS(id: string): boolean {
      const link = this.loadedStyles.get(id);

      if (link) {
        link.remove();
        this.loadedStyles.delete(id);
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
