/*
 * --------------------------------------------------------------------------
 * File: pdf-optimization.config.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Configuration for PDF optimization settings.
 * Contains settings to reduce PDF file size while maintaining quality.
 * --------------------------------------------------------------------------
 */

import { PDFOptions } from 'puppeteer';

export interface PdfOptimizationConfig {
  puppeteerArgs: string[];
  viewportSettings: {
    width: number;
    height: number;
    deviceScaleFactor: number;
  };
  pdfOptions: PDFOptions;
  cssOptimizations: string;
  resourceBlocking: {
    blockedTypes: string[];
    blockedDomains: string[];
  };
}

/**
 * Get PDF optimization configuration based on environment
 */
export function getPdfOptimizationConfig(): PdfOptimizationConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const compressionLevel = process.env.PDF_COMPRESSION_LEVEL || 'medium';

  let scale = 0.75;
  let deviceScaleFactor = 1;

  switch (compressionLevel) {
    case 'high':
      scale = 0.6;
      deviceScaleFactor = 0.8;
      break;
    case 'medium':
      scale = 0.75;
      deviceScaleFactor = 1;
      break;
    case 'low':
      scale = 0.9;
      deviceScaleFactor = 1.2;
      break;
  }

  return {
    puppeteerArgs: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--memory-pressure-off',
      '--max_old_space_size=4096',
      '--disable-ipc-flooding-protection',
      ...(isProduction ? ['--single-process'] : []),
    ],

    viewportSettings: {
      width: 794, // A4 width at 96 DPI
      height: 1123, // A4 height at 96 DPI
      deviceScaleFactor,
    },

    pdfOptions: {
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      margin: {
        top: '8mm',
        bottom: '8mm',
        left: '8mm',
        right: '8mm',
      },
      scale,
      omitBackground: false,
      timeout: 360000,
      tagged: false, // Disable for smaller file size
    },

    cssOptimizations: `
      @media print {
        * {
          -webkit-print-color-adjust: exact !important;
          color-adjust: exact !important;
          font-smooth: never !important;
          -webkit-font-smoothing: none !important;
          -moz-osx-font-smoothing: unset !important;
        }
        
        /* Optimize images */
        img {
          max-width: 100% !important;
          height: auto !important;
          image-rendering: optimizeSpeed !important;
          -webkit-optimize-contrast: true !important;
        }
        
        /* Remove expensive visual effects */
        * {
          box-shadow: none !important;
          text-shadow: none !important;
          filter: none !important;
          -webkit-filter: none !important;
          border-radius: 0 !important;
          transform: none !important;
          transition: none !important;
          animation: none !important;
        }
        
        /* Optimize backgrounds */
        * {
          background-attachment: scroll !important;
          background-size: contain !important;
        }
        
        /* Hide decorative elements */
        .shadow, .box-shadow, .drop-shadow, .gradient {
          display: none !important;
        }
        
        /* Compress large images */
        img[width], img[height] {
          max-width: 600px !important;
          height: auto !important;
        }
        
        /* Optimize table borders */
        table, th, td {
          border-collapse: collapse !important;
          border-spacing: 0 !important;
        }
      }
      
      /* General optimizations */
      img {
        image-rendering: -webkit-optimize-contrast !important;
        image-rendering: crisp-edges !important;
      }
      
      /* Remove animations and transitions for faster rendering */
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,

    resourceBlocking: {
      blockedTypes: ['font', 'media', 'websocket', 'eventsource', 'other'],
      blockedDomains: [
        'analytics',
        'tracking',
        'ads',
        'facebook',
        'google-analytics',
        'googlesyndication',
        'doubleclick',
        'googletag',
        'gtm',
        'hotjar',
        'mixpanel',
        'segment',
      ],
    },
  };
}

/**
 * JavaScript code to inject for image optimization
 */
export const imageOptimizationScript = `
  // Compress and optimize images
  const images = document.querySelectorAll('img');
  images.forEach((img) => {
    // Limit image dimensions
    if (img.naturalWidth > 800) {
      img.style.maxWidth = '800px';
      img.style.height = 'auto';
    }
    
    // Optimize rendering
    img.style.imageRendering = 'optimizeSpeed';
    
    // Remove high-resolution attributes that increase file size
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
  });
  
  // Remove or hide heavy media elements
  const heavyElements = document.querySelectorAll('video, iframe, embed, object, audio');
  heavyElements.forEach((el) => {
    el.style.display = 'none';
  });
  
  // Optimize SVGs
  const svgs = document.querySelectorAll('svg');
  svgs.forEach((svg) => {
    svg.style.shapeRendering = 'optimizeSpeed';
    svg.style.textRendering = 'optimizeSpeed';
  });
  
  // Remove data attributes that might contain large data
  const elementsWithData = document.querySelectorAll('[data-*]');
  elementsWithData.forEach((el) => {
    // Remove large data attributes but keep necessary ones
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.startsWith('data-') && attr.value.length > 100) {
        el.removeAttribute(attr.name);
      }
    });
  });
  
  // Optimize canvas elements
  const canvases = document.querySelectorAll('canvas');
  canvases.forEach((canvas) => {
    // Reduce canvas resolution if too high
    if (canvas.width > 1000 || canvas.height > 1000) {
      const ratio = Math.min(1000 / canvas.width, 1000 / canvas.height);
      canvas.width *= ratio;
      canvas.height *= ratio;
    }
  });
`;

export default getPdfOptimizationConfig;
