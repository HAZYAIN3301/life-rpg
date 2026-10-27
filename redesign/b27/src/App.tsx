import { Theme } from './settings/types';
import { B2Workbench as SatoruB2 } from './components/generated/B2Workbench';

let theme: Theme = 'light';

function App() {
  function setTheme(theme: Theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  setTheme(theme);

  return (
    <>
      <SatoruB2 />
    </>
  ); // %EXPORT_STATEMENT%
}

export default App;
