#!/usr/bin/env python3

import re
import base64
import os
import requests
import logging
import argparse
import sys
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urljoin, urlparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

class CSSInliner:
    def __init__(self, base_path: Optional[str] = None):
        """
        Initialize the CSS Inliner.
        
        Args:
            base_path: Base path for resolving relative URLs. If None, uses current directory.
        """
        self.base_path = Path(base_path) if base_path else Path.cwd()
        self.url_pattern = re.compile(
            r'url\(\s*["\']?(.*?\.svg)["\']?\s*\)',
            re.IGNORECASE
        )

    def is_url(self, path: str) -> bool:
        """Check if the path is a URL."""
        return path.startswith(('http://', 'https://'))

    def resolve_path(self, svg_path: str) -> str:
        """Resolve relative paths to absolute paths."""
        if self.is_url(svg_path):
            return svg_path
        
        if Path(svg_path).is_absolute():
            return svg_path
        
        return str(self.base_path / svg_path)

    def fetch_svg_content(self, path: str) -> Tuple[bytes, bool]:
        """Fetch SVG content from URL or file system."""
        try:
            if self.is_url(path):
                response = requests.get(path, timeout=10)
                response.raise_for_status()
                return response.content, True
            else:
                with open(path, 'rb') as f:
                    return f.read(), True
        except requests.RequestException as e:
            logger.error(f"Failed to fetch URL {path}: {e}")
            return b'', False
        except IOError as e:
            logger.error(f"Failed to read file {path}: {e}")
            return b'', False

    def to_data_uri(self, content: bytes) -> str:
        """Convert SVG content to base64 data URI."""
        base64_data = base64.b64encode(content).decode('utf-8')
        return f"data:image/svg+xml;base64,{base64_data}"

    def process_css(self, input_path: str, output_path: Optional[str] = None) -> bool:
        """
        Process CSS file and replace SVG URLs with data URIs.
        
        Args:
            input_path: Path to input CSS file
            output_path: Path to output CSS file. If None, modifies input file in-place
        """
        input_path = Path(input_path)
        if not input_path.exists():
            logger.error(f"Input file not found: {input_path}")
            return False

        try:
            # Read input CSS file
            with open(input_path, 'r', encoding='utf-8') as f:
                css_content = f.read()

            # Set base path to input file's directory
            self.base_path = input_path.parent

            # Track statistics
            total_svgs = 0
            successful_conversions = 0

            def replace_url(match):
                nonlocal total_svgs, successful_conversions
                total_svgs += 1
                
                svg_path = match.group(1)
                resolved_path = self.resolve_path(svg_path)
                
                content, success = self.fetch_svg_content(resolved_path)
                if success:
                    successful_conversions += 1
                    data_uri = self.to_data_uri(content)
                    return f"url('{data_uri}')"
                return match.group(0)

            # Replace all SVG URLs with data URIs
            new_css_content = self.url_pattern.sub(replace_url, css_content)

            # Determine output path
            final_output_path = Path(output_path) if output_path else input_path

            # Create backup if modifying in-place
            if output_path is None:
                backup_path = input_path.with_suffix(input_path.suffix + '.bak')
                input_path.rename(backup_path)
                logger.info(f"Created backup at: {backup_path}")

            # Write output CSS file
            with open(final_output_path, 'w', encoding='utf-8') as f:
                f.write(new_css_content)

            # Log statistics
            if total_svgs > 0:
                logger.info(f"Processed {total_svgs} SVG URLs")
                logger.info(f"Successfully converted: {successful_conversions}")
                if total_svgs - successful_conversions > 0:
                    logger.warning(f"Failed to convert: {total_svgs - successful_conversions}")
            else:
                logger.info("No SVG URLs found in the file")

            logger.info(f"Output written to: {final_output_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to process CSS file: {e}")
            return False

def main():
    """Command-line interface for the CSS Inliner."""
    parser = argparse.ArgumentParser(
        description="Convert SVG URLs in CSS files to data URIs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s styles.css                # Modifies file in-place
  %(prog)s styles.css -o output.css  # Saves to new file
  %(prog)s -v styles.css            # Verbose output
        """
    )
    
    parser.add_argument(
        'file',
        help="CSS file to process"
    )
    parser.add_argument(
        '-o', '--output',
        help="Output file path (optional, defaults to modifying input file)",
        default=None
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help="Enable verbose output"
    )

    args = parser.parse_args()

    # Set logging level based on verbose flag
    if args.verbose:
        logger.setLevel(logging.DEBUG)

    # Process the CSS file
    css_inliner = CSSInliner()
    success = css_inliner.process_css(args.file, args.output)
    
    # Exit with appropriate status code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()