export interface Theme {
  id: string
  name: string
  type: 'dark' | 'light'
  colors: {
    '--bg-app': string
    '--bg-sidebar': string
    '--bg-activity-bar': string
    '--bg-panel-header': string
    '--bg-input': string
    '--border-color': string
    '--accent-primary': string
    '--accent-hover': string
    '--focus-border': string
    '--text-primary': string
    '--text-secondary': string
    '--text-white': string
    '--tab-active-bg': string
    '--tab-active-fg': string
    '--list-hover-bg': string
    '--list-active-bg': string
    '--bg-status-bar': string
    '--fg-status-bar': string
    '--scrollbar-thumb': string
    '--scrollbar-thumb-hover': string
  }
}

export const themes: Theme[] = [
  // 1. VS CODE DARK (Default)
  {
    id: 'vscode-dark',
    name: 'VS Code Dark',
    type: 'dark',
    colors: {
      '--bg-app': '#1e1e1e',
      '--bg-sidebar': '#252526',
      '--bg-activity-bar': '#333333',
      '--bg-panel-header': '#2d2d2d',
      '--bg-input': '#3c3c3c',
      '--border-color': '#454545',
      '--accent-primary': '#0e639c',
      '--accent-hover': '#1177bb',
      '--focus-border': '#007acc',
      '--text-primary': '#cccccc',
      '--text-secondary': '#999999',
      '--text-white': '#ffffff',
      '--tab-active-bg': '#1e1e1e',
      '--tab-active-fg': '#ffffff',
      '--list-hover-bg': '#2a2d2e',
      '--list-active-bg': '#37373d',
      '--bg-status-bar': '#007acc',
      '--fg-status-bar': '#ffffff',
      '--scrollbar-thumb': '#424242',
      '--scrollbar-thumb-hover': '#4f4f4f'
    }
  },
  // 2. GITHUB LIGHT
  {
    id: 'github-light',
    name: 'GitHub Light',
    type: 'light',
    colors: {
      '--bg-app': '#ffffff',
      '--bg-sidebar': '#f6f8fa',
      '--bg-activity-bar': '#e1e4e8',
      '--bg-panel-header': '#f6f8fa',
      '--bg-input': '#ffffff',
      '--border-color': '#d0d7de',
      '--accent-primary': '#0969da',
      '--accent-hover': '#0a53be',
      '--focus-border': '#0969da',
      '--text-primary': '#24292f',
      '--text-secondary': '#57606a',
      '--text-white': '#ffffff',
      '--tab-active-bg': '#ffffff',
      '--tab-active-fg': '#24292f',
      '--list-hover-bg': '#ebf0f4',
      '--list-active-bg': '#e6ebf1',
      '--bg-status-bar': '#0969da',
      '--fg-status-bar': '#ffffff',
      '--scrollbar-thumb': '#d0d7de',
      '--scrollbar-thumb-hover': '#959da5'
    }
  },
  // 3. DRACULA (Новая)
  {
    id: 'dracula',
    name: 'Dracula',
    type: 'dark',
    colors: {
      '--bg-app': '#282a36',
      '--bg-sidebar': '#21222c',
      '--bg-activity-bar': '#191a21',
      '--bg-panel-header': '#282a36',
      '--bg-input': '#44475a',
      '--border-color': '#6272a4',
      '--accent-primary': '#bd93f9',
      '--accent-hover': '#ff79c6',
      '--focus-border': '#bd93f9',
      '--text-primary': '#f8f8f2',
      '--text-secondary': '#6272a4',
      '--text-white': '#ffffff',
      '--tab-active-bg': '#282a36',
      '--tab-active-fg': '#bd93f9',
      '--list-hover-bg': '#44475a',
      '--list-active-bg': '#44475a',
      '--bg-status-bar': '#bd93f9',
      '--fg-status-bar': '#282a36',
      '--scrollbar-thumb': '#44475a',
      '--scrollbar-thumb-hover': '#6272a4'
    }
  },
  // 4. MONOKAI (Новая)
  {
    id: 'monokai',
    name: 'Monokai Classic',
    type: 'dark',
    colors: {
      '--bg-app': '#272822',
      '--bg-sidebar': '#1e1f1c',
      '--bg-activity-bar': '#171814',
      '--bg-panel-header': '#272822',
      '--bg-input': '#414339',
      '--border-color': '#1e1f1c',
      '--accent-primary': '#a6e22e',
      '--accent-hover': '#f92672',
      '--focus-border': '#a6e22e',
      '--text-primary': '#f8f8f2',
      '--text-secondary': '#75715e',
      '--text-white': '#f8f8f2',
      '--tab-active-bg': '#272822',
      '--tab-active-fg': '#a6e22e',
      '--list-hover-bg': '#3e3d32',
      '--list-active-bg': '#49483e',
      '--bg-status-bar': '#414339',
      '--fg-status-bar': '#f8f8f2',
      '--scrollbar-thumb': '#3e3d32',
      '--scrollbar-thumb-hover': '#75715e'
    }
  },
  // 5. SOLARIZED LIGHT (Новая)
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    type: 'light',
    colors: {
      '--bg-app': '#fdf6e3',
      '--bg-sidebar': '#eee8d5',
      '--bg-activity-bar': '#d3c6aa',
      '--bg-panel-header': '#eee8d5',
      '--bg-input': '#fdf6e3',
      '--border-color': '#d3c6aa',
      '--accent-primary': '#2aa198',
      '--accent-hover': '#268bd2',
      '--focus-border': '#2aa198',
      '--text-primary': '#657b83',
      '--text-secondary': '#93a1a1',
      '--text-white': '#ffffff',
      '--tab-active-bg': '#fdf6e3',
      '--tab-active-fg': '#b58900',
      '--list-hover-bg': '#e0d8c0',
      '--list-active-bg': '#d3c6aa',
      '--bg-status-bar': '#eee8d5',
      '--fg-status-bar': '#657b83',
      '--scrollbar-thumb': '#d3c6aa',
      '--scrollbar-thumb-hover': '#93a1a1'
    }
  },
  // 6. ATOM ONE DARK (Refined)
  {
    id: 'atom-one-dark',
    name: 'Atom One Dark',
    type: 'dark',
    colors: {
      '--bg-app': '#282c34', // Editor BG
      '--bg-sidebar': '#21252b', // Sidebar
      '--bg-activity-bar': '#333842',
      '--bg-panel-header': '#21252b',
      '--bg-input': '#353b45', // Lighter than BG, good for contrast against #282c34.
      // User said "buttons strongly light". If buttons use bg-input, and it was #1d1f23 (dark),
      // maybe they meant text? Or borders?
      // Let's try standard Atom colors.
      // Atom One Dark uses #353b45 or #1d1f23 for inputs.
      // Let's set border to #181a1f (too black).
      // Let's set border to #3e4451 (Soft Grey).
      '--border-color': '#3e4451',

      '--accent-primary': '#4e78cc', // User preference
      '--accent-hover': '#5a84d8', // Slightly lighter version of #4e78cc for hover
      '--focus-border': '#4e78cc',
      '--text-primary': '#abb2bf', // Standard Atom Text
      '--text-secondary': '#5c6370',
      '--text-white': '#dcdfe4',
      '--tab-active-bg': '#282c34',
      '--tab-active-fg': '#dcdfe4', // Using text-white for visibility
      '--list-hover-bg': '#2c313a',
      '--list-active-bg': '#3a404b',
      '--bg-status-bar': '#21252b', // Dark, matching sidebar
      '--fg-status-bar': '#abb2bf', // Standard text color
      '--scrollbar-thumb': '#3e4451',
      '--scrollbar-thumb-hover': '#5c6370'
    }
  }
]
