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
      '--list-active-bg': '#37373d'
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
      '--list-active-bg': '#e6ebf1'
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
      '--bg-activity-bar': '#191a21', // Самый темный
      '--bg-panel-header': '#282a36',
      '--bg-input': '#44475a',
      '--border-color': '#6272a4', // Фиолетово-серый
      '--accent-primary': '#bd93f9', // Dracula Purple
      '--accent-hover': '#ff79c6', // Dracula Pink
      '--focus-border': '#bd93f9',
      '--text-primary': '#f8f8f2',
      '--text-secondary': '#6272a4',
      '--text-white': '#ffffff',
      '--tab-active-bg': '#282a36',
      '--tab-active-fg': '#bd93f9',
      '--list-hover-bg': '#44475a',
      '--list-active-bg': '#44475a'
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
      '--accent-primary': '#a6e22e', // Green
      '--accent-hover': '#f92672', // Pink
      '--focus-border': '#a6e22e',
      '--text-primary': '#f8f8f2',
      '--text-secondary': '#75715e',
      '--text-white': '#f8f8f2',
      '--tab-active-bg': '#272822',
      '--tab-active-fg': '#a6e22e',
      '--list-hover-bg': '#3e3d32',
      '--list-active-bg': '#49483e'
    }
  },
  // 5. SOLARIZED LIGHT (Новая)
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    type: 'light',
    colors: {
      '--bg-app': '#fdf6e3', // Base3 (Cream)
      '--bg-sidebar': '#eee8d5', // Base2
      '--bg-activity-bar': '#d3c6aa', // Немного темнее Base2
      '--bg-panel-header': '#eee8d5',
      '--bg-input': '#fdf6e3',
      '--border-color': '#d3c6aa',
      '--accent-primary': '#2aa198', // Cyan
      '--accent-hover': '#268bd2', // Blue
      '--focus-border': '#2aa198',
      '--text-primary': '#657b83', // Base00
      '--text-secondary': '#93a1a1', // Base1
      '--text-white': '#ffffff',
      '--tab-active-bg': '#fdf6e3',
      '--tab-active-fg': '#b58900', // Yellow
      '--list-hover-bg': '#e0d8c0',
      '--list-active-bg': '#d3c6aa'
    }
  }
]
