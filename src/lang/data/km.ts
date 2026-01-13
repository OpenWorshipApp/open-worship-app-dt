import { LanguageDataType } from '../langHelpers';

const numList = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];

const dictionary = {
    General: 'ទូទៅ',
    Bible: 'ព្រះគម្ពីរ',
    About: 'អារម្មណ៏កថា',
    Presenter: 'ធ្វើបទបង្ហាញ',
    Colors: 'ពណ៌',
    Images: 'រូបភាព',
    Videos: 'វីដេអូ',
    Text: 'អក្សរ',
    Box: 'ប្រអប់',
    Appearance: 'រូបរាង',
    Shadow: 'ស្រមោល',
    Lyric: 'ចំរៀង',
    Slide: 'ស្លាយ',
    'Full Text': 'បង្ហាញពេញ',
    'Add Extra Bible': 'Add Extra Bible',
    'Add Items': 'Add Items',
    'Add Time': 'Add Time',
    'Advance Bible Lookup': 'Advance Bible Lookup',
    'Apply All Slides': 'Apply All Slides',
    'Apply changed dimension to this slide':
        'Apply changed dimension to this slide',
    'Apply changed name to this slide': 'Apply changed name to this slide',
    Apply: 'Apply',
    'Are you sure to discard all histories?':
        'Are you sure to discard all histories?',
    'Audio playing': 'Audio playing',
    Audios: 'Audios',
    'Auto Play Audio AI when available': 'Auto Play Audio AI when available',
    'Backdrop Filter (PX):': 'Backdrop Filter (PX):',
    'Background Color:': 'Background Color:',
    'Background Images Slide Show': 'Background Images Slide Show',
    'Bible key': 'Bible key',
    'Bible Lookup': 'Bible Lookup',
    'Camera Show': 'Camera Show',
    'Change Bible Model Info': 'Change Bible Model Info',
    'Clear All Settings': 'Clear All Settings',
    'Clear All': 'Clear All',
    'Clear Background': 'Clear Background',
    'Clear Bible': 'Clear Bible',
    'Clear Cache': 'Clear Cache',
    'Clear Color Note': 'Clear Color Note',
    'Clear Foreground': 'Clear Foreground',
    'Clear Slide': 'Clear Slide',
    Clear: 'Clear',
    'Click to change Stage Number': 'Click to change Stage Number',
    'Copy All Items': 'Copy All Items',
    'Copy All': 'Copy All',
    'Copy Chapter Full Key': 'Copy Chapter Full Key',
    'Copy Selected Text': 'Copy Selected Text',
    'Copy Text': 'Copy Text',
    'Copy Title': 'Copy Title',
    'Copy Verse Full Key': 'Copy Verse Full Key',
    Copy: 'Copy',
    Countdown: 'Countdown',
    'Create Anthropic api key': 'Create Anthropic api key',
    'Create New File': 'Create New File',
    'Create OpenAI api key': 'Create OpenAI api key',
    'Creating Default Folder': 'Creating Default Folder',
    Dark: 'Dark',
    Decrement: 'Decrement',
    'Define a Bible key': 'Define a Bible key',
    Delete: 'Delete',
    'Dictionary for Selected Text': 'Dictionary for Selected Text',
    'Discard changed': 'Discard changed',
    'Download From URL': 'Download From URL',
    Download: 'Download',
    Duplicate: 'Duplicate',
    'Edit Parent Path': 'Edit Parent Path',
    'Edit this web file': 'Edit this web file',
    Edit: 'Edit',
    'edit-item-thumb': 'edit-item-thumb',
    Editor: 'Editor',
    Empty: 'Empty',
    'Exit Full': 'Exit Full',
    'Font Family': 'Font Family',
    Foreground: 'Foreground',
    'Full Width': 'Full Width',
    Full: 'Full',
    'Generated using AI technology.': 'Generated using AI technology.',
    'Generated using Google Translate.': 'Generated using Google Translate.',
    'Go Back to Presenter': 'Go Back to Presenter',
    'Go to Bible Setting': 'Go to Bible Setting',
    'Go to Settings': 'Go to Settings',
    'Hide Camera': 'Hide Camera',
    'Hide Countdown': 'Hide Countdown',
    'Hide Editor': 'Hide Editor',
    'Hide Marquee': 'Hide Marquee',
    'Hide Quick Text': 'Hide Quick Text',
    'Hide Stopwatch': 'Hide Stopwatch',
    'Hide Time': 'Hide Time',
    'Hide Web': 'Hide Web',
    Import: 'Import',
    Increment: 'Increment',
    'Insert Image or Video': 'Insert Image or Video',
    'Invalid Path': 'Invalid Path',
    'Key is missing': 'Key is missing',
    Language: 'Language',
    'Learn More About Web Development': 'Learn More About Web Development',
    Light: 'Light',
    Lookup: 'Lookup',
    'Markdown Music Help': 'Markdown Music Help',
    Marquee: 'Marquee',
    'Mix Color:': 'Mix Color:',
    'Move All Items To': 'Move All Items To',
    'Move backward': 'Move backward',
    'Move down': 'Move down',
    'Move forward': 'Move forward',
    'Move to Trash': 'Move to Trash',
    'Move To': 'Move To',
    'Move up': 'Move up',
    'New File Name': 'New File Name',
    'New File': 'New File',
    'No App Document Selected': 'No App Document Selected',
    'No Bible Available': 'No Bible Available',
    'No canvas item selected': 'No canvas item selected',
    'No Color': 'No Color',
    'No Lyric Selected': 'No Lyric Selected',
    'No Parent Directory Selected': 'No Parent Directory Selected',
    'Not Full Width': 'Not Full Width',
    'Numbers map': 'Numbers map',
    'On Screen Width:': 'On Screen Width:',
    'Opacity (%)': 'Opacity (%)',
    'Opacity:': 'Opacity:',
    'Open in Cross Reference': 'Open in Cross Reference',
    'Open Shared Link': 'Open Shared Link',
    Open: 'Open',
    'Original Size': 'Original Size',
    'Other General Options': 'Other General Options',
    'Parent Directory:': 'Parent Directory:',
    'Parse Markup String (HTML|XML)': 'Parse Markup String (HTML|XML)',
    'Paste Image': 'Paste Image',
    Paste: 'Paste',
    'Path Settings': 'Path Settings',
    'Please select an item to edit': 'Please select an item to edit',
    'Please stop the audio before leaving the page.':
        'Please stop the audio before leaving the page.',
    Properties: 'Properties',
    'Quick Edit': 'Quick Edit',
    'Quick Text': 'Quick Text',
    Refresh: 'Refresh',
    Remove: 'Remove',
    'Repeat this audio': 'Repeat this audio',
    'Reset All Child Directories': 'Reset All Child Directories',
    'Reset Rotate': 'Reset Rotate',
    'Reset to default display dimension': 'Reset to default display dimension',
    'Reset Widgets Size': 'Reset Widgets Size',
    Reset: 'Reset',
    'Round (%)': 'Round (%)',
    'Round Size %:': 'Round Size %:',
    'Round Size Pixel:': 'Round Size Pixel:',
    'Save bible item and show on screen': 'Save bible item and show on screen',
    'Save bible item': 'Save bible item',
    Save: 'Save',
    Scale: 'Scale',
    'Scale:': 'Scale:',
    'Search in Bible Search': 'Search in Bible Search',
    'Search Selected Text on Google': 'Search Selected Text on Google',
    'Select Default Folder': 'Select Default Folder',
    'Set OpenAI API Key for Audio AI': 'Set OpenAI API Key for Audio AI',
    Setting: 'Setting',
    'shift + click to append': 'shift + click to append',
    'Shift Click to Add': 'Shift Click to Add',
    'Show all verses': 'Show all verses',
    'Show bible item': 'Show bible item',
    'Show Editor': 'Show Editor',
    Show: 'Show',
    'Split horizontal': 'Split horizontal',
    'Split Horizontal': 'Split Horizontal',
    'Split vertical': 'Split vertical',
    'Stage:': 'Stage:',
    Stopwatch: 'Stopwatch',
    Strip: 'Strip',
    System: 'System',
    'Text Color:': 'Text Color:',
    Theme: 'Theme',
    'There is no parent directory selected':
        'There is no parent directory selected',
    'This will change all Slides': 'This will change all Slides',
    'Time Second Delay:': 'Time Second Delay:',
    'Time Second to Live:': 'Time Second to Live:',
    Time: 'Time',
    'Toggle Fading at End': 'Toggle Fading at End',
    'Toggle is video should fade at the end':
        'Toggle is video should fade at the end',
    'Toggle Wrap Text': 'Toggle Wrap Text',
    'Transition:': 'Transition:',
    'Unsupported file type!': 'Unsupported file type!',
    'Web Show': 'Web Show',
    'Width (%)': 'Width (%)',
    'Width (%):': 'Width (%):',
    'Will reload the app to apply settings':
        'Will reload the app to apply settings',
    'Slide Editor': 'កែសម្រួលស្លាយ',
};
const fontFamily = 'km-font-family';
const lang: LanguageDataType = {
    locale: 'km-KH',
    langCode: 'km',
    genCss: () => {
        if (lang.dirPath === undefined) {
            return '';
        }
        const fontBR = `${lang.dirPath}/Battambang-Regular.ttf`;
        const fontBB = `${lang.dirPath}/Battambang-Bold.ttf`;
        return `
        @font-face {
            font-family: ${fontFamily};
            src: url(${fontBR}) format("truetype");
        }
        @font-face {
            font-family: ${fontFamily};
            src: url(${fontBB}) format("truetype");
            font-weight: bold;
        }
        `;
    },
    fontFamily,
    numList,
    dictionary,
    name: 'Khmer',
    flagSVG: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" id="flag-icons-kh" viewBox="0 0 640 480">
    <path fill="#032ea1" d="M0 0h640v480H0z"/>
    <path fill="#e00025" d="M0 120h640v240H0z"/>
    <g fill="#fff" stroke="#000" transform="matrix(1.2 0 0 1.2 85.6 -522)">
      <g stroke-linejoin="bevel">
        <path d="M139 623.5h113.8v43.8H139z"/>
        <path d="M247 647.6h3.5v16.5H247zm-108-8.1h113.8v5H139zm0-7h113.8v4.6H139z"/>
        <path stroke-width=".9" d="M139 625.7h113.8v4.3H139z"/>
        <path d="M169 647.6h3.6v16.5H169zm49 0h3.6v16.5H218zm-78 0h3.5v16.5H140zm7 0h3.5v16.5H147zm7.5 0h3.5v16.5h-3.5zm7.5 0h3.5v16.5H162zm62.8 0h3.6v16.5h-3.6zm7.5 0h3.6v16.5h-3.6zm7.5 0h3.6v16.5h-3.6z"/>
        <path stroke-linejoin="miter" d="M94.5 669.5a9.3 9.3 0 0 0 4.4-5.3H292a9.3 9.3 0 0 0 4.4 5.3z"/>
      </g>
      <path d="M193 556.8s-.1-4.1 2.3-4.2c2.3 0 2.2 4.2 2.2 4.2zm-12.5 54.5v-5.5c0-2.8-2.8-3-2.8-5 0 0-.4-3 .4-4.4 1.1 4 3 3.3 3 1.6 0-1.4-1-2.8-3.3-6.3-.8-1.1-.3-4.6.7-5.9.4 3 .9 4.5 2.2 4.5.8 0 1.4-.5 1.4-2 0-2-1.3-3-2-4.8a5 5 0 0 1 1.1-5.3c.5 3 .4 4.2 1.7 4.2 2.7-.9 0-4.8-.6-5.8-.6-1.1 1-3.4 1-3.4.8 2.7 1 2.9 2 2.6 1.2-.3 1-2-.4-3.4-.9-1-.8-2.3.2-3.3 1 1.9 2.2 1.8 2.3.6l-.8-4.4H204l-.9 4.3c-.2 1.2 1.4 1.5 2.4-.5 1 1 1.1 2.4.2 3.3-1.4 1.4-1.6 3.1-.4 3.4 1 .3 1.2 0 2-2.6 0 0 1.5 1.5 1 3.4-.6 1-3.3 5-.6 5.8 1.3 0 1.2-1.2 1.7-4.2a5 5 0 0 1 1 5.3c-.6 1.8-2 2.8-2 4.8 0 1.5.7 2 1.5 2 1.3 0 1.8-1.4 2.2-4.5 1 1.3 1.5 4.8.7 6-2.3 3.4-3.4 4.8-3.4 6.2 0 1.7 2 2.4 3-1.6.9 1.4.5 4.4.5 4.4 0 2-2.7 2.2-2.8 5v5.5zm7.2-46-.4-3.1h15.9l-.4 3.1zm1-3.2-.2-2.5H202l-.3 2.5zm2.3-2.6-.3-2.6h9l-.1 2.6zm33 110c-2-.7-5-2.9-5-5v-24.3l2.6-3.4H169l2.5 3.4v24.3c0 2.1-2 4.3-4 5z"/>
      <path stroke-linejoin="bevel" d="M178.2 647.6h3.6v16.5h-3.6zm30.4 0h3.6v16.5h-3.6z"/>
      <path d="M168 609.2v27.6h54v-27.6a4.2 4.2 0 0 0-2.6 2.8v11.8h-48.7V612s-.6-2-2.8-2.8z"/>
      <path d="M214.6 669.5c-1.8-.7-5.6-2.9-5.6-5v-27.2c.4-1.5 2.4-2.4 3.7-3.4H177c1.7 1 3.6 1.7 4.3 3.4v27.2c0 2.1-3 4.3-4.8 5z"/>
      <path d="M219.4 634.2v-19.6h-4.9v-1.9h-38.8v2h-5v19.5zM207 669.5c-1.8-.7-4.3-2.9-4.3-5v-23.2l1.4-2.1h-17.7l1.5 2v23.3c0 2.1-2.6 4.3-4.3 5z"/>
      <path d="M190.7 639.2h9v30.3h-9z"/>
      <path stroke-linejoin="bevel" d="M204.4 632.5c0-2 5.8-2.1 8.8-3.8h-36c3 1.7 8.7 1.8 8.7 3.8l1.2 3.9 15 .6z"/>
      <path d="M211.4 611.3c0-4.9.2-6.7 1.7-6.7V620c-3.7 1.4-6.3 6-6.3 6h-23.2s-2.6-4.6-6.3-6v-15.5c1.8 0 1.8 2 1.8 6.7zm1.7-2c0-5.6 4.9-6.2 4.9-6.2v5c-1.9-.1-2.8 1.6-2.8 4 0 2.5 1.5 2.5 1.5 2.5v14.2h-3.6z"/>
      <path d="M177.3 609.3c0-5.6-4.9-6.2-4.9-6.2v5c1.9-.1 2.8 1.6 2.8 4 0 2.5-1.5 2.5-1.5 2.5v14.2h3.6z"/>
      <g fill="none" stroke-width=".8">
        <path d="M186.8 570.6H204m-19.2 5.4h21m-23 6.5h24.9m-27 7.9h29.5m-30.2 9h30.4"/>
        <path stroke-width="1" d="M170.8 629h48.6m-33.2 0h18v6.6h-18z"/>
      </g>
      <path d="M184 614.2c3 3.6 2.6 9.7 2.6 13.3H204c0-3.6-.4-9.7 2.6-13.3zm9.7-41-2.4-1.3v-3.5c1 .3 2 .4 2.2 2 .3-2.3 1-2.1 1.9-3 1 .9 1.5.7 1.9 3 0-1.6 1.2-1.7 2.1-2v3.5l-2.3 1.2z"/>
      <path d="m193.5 578.9-4-2.8V573c1.5.3 3 .5 3.2 2.2.4-2.5 1.3-3.7 2.7-4.7 1.3 1 2.2 2.2 2.7 4.7.1-1.7 1.7-1.9 3-2.2v3.2l-3.9 2.7z"/>
      <path d="m193.2 587.8-4.5-4v-4.7c1.6.4 3.4.6 3.6 3.1.5-3.5 1.5-5.4 3-6.8 1.6 1.4 2.6 3.3 3.2 6.8.2-2.5 2-2.7 3.6-3.1v4.7l-4.6 4zm8.4 5.3-4 5.7h-4.7l-4.1-5.7zm-15.2 9.5c2 1.1 2.8 3.4 3 7.6H201c.2-4.2 1-6.5 3-7.6z"/>
      <path stroke-linejoin="bevel" d="M204.2 593v-5.6a5.2 5.2 0 0 0-3.8 3.3c0-2-2.5-6.3-5.2-8.5-2.7 2.4-5.3 6.4-5.2 8.4-.5-1.5-1.8-2.7-3.8-3.2v5.7z"/>
      <path stroke-linejoin="bevel" d="M205 602.6V597c-2.1.6-3.5 1.7-4.1 3.3 0-2-2.7-6.3-5.7-8.5-3 2.5-5.8 6.4-5.7 8.5-.5-1.5-2-2.7-4.1-3.3v5.7z"/>
      <path stroke-linejoin="bevel" d="M207.4 614.3v-6.6a9.6 9.6 0 0 0-5.1 3.8c0-3.5-4-9-7.1-10.7-3.2 1.8-7.1 7.4-7.1 10.7a9.7 9.7 0 0 0-5.2-3.8v6.6z"/>
      <path stroke-linejoin="bevel" d="M206 629v-6.8c-2.4.9-3 3.1-3.8 4.7.3-6.9-3.8-14.2-7-16.1-3.2 1.9-7.4 9.4-7 16-.8-1.4-1.5-3.7-3.8-4.6v6.7z"/>
      <path d="M204.4 639.2v-6.8c-2.5.6-2.6 1.5-3.4 3 .3-4.1-2.6-8.8-5.8-10.6-3.2 1.8-6 6.5-5.8 10.6-.8-1.5-.9-2.4-3.4-3v6.8z"/>
      <g id="a">
        <path d="M99 664.2v-20.4c-.7-2.6-3-5-4.6-5.4v-18l3.7 2 4.3 18.9v23z"/>
        <path d="M99 664.3v-20.5c-.7-2.6-3-5-4.6-5.4v-19.2c2.5 0 3.7 3.2 3.7 3.2l4.3 18.9v22.9z"/>
        <path d="M96.3 669.5c1.7-.7 4.2-2.9 4.2-5v-25.6l-1.2-2H143l-1.7 2v25.6a6 6 0 0 0 3.4 5z"/>
        <path d="M135.8 669.5c-1.7-.7-4.2-2.9-4.2-5v-24.3l3.6-3.4h-29.6l3.6 3.4v24.3c0 2.1-2.5 4.3-4.2 5z"/>
        <path d="M131.7 669.5c-1.7-.7-4.3-2.9-4.3-5v-22l2.4-3.3H111l2.4 3.3v22c0 2.1-2.5 4.3-4.3 5z"/>
        <path d="M116 639.2h8.9v30.4h-9z"/>
        <path stroke-linejoin="bevel" d="M103.7 647.6h3.6v16.5h-3.6zm30.8 0h3.5v16.5h-3.6zm-33.9-27.8h4.4v17h-4.4zm0-3.2h4.3v3.2h-4.3zm35.6 6.9h6.1v13h-6.1z"/>
        <path d="M104.9 636.6v-29c1.2 0 1.4 4.3 4.2 4.3 1.5 0 1.4-1.8.5-3.2-.7-1.3-1.6-3-.4-6.3.9 2.5 3.1 3.3 2.7 1.8-.7-2.7-2.8-3.2-1.2-7.3.5 3.4 2.7 3.3 2.2 1.3-.6-2.3-1.9-3.3-.3-6.5.9 3.7 2 3.5 2 1.2 0-3.4 0-7 4.2-8.3 0 0 .3-3 1.9-3 1.5 0 1.8 3 1.8 3 4.3 1.3 4.2 5 4.2 8.3 0 2.3 1.1 2.5 2-1.2 1.6 3.2.3 4.2-.3 6.5-.5 2 1.7 2.1 2.2-1.3 1.6 4.1-.5 4.6-1.2 7.3-.4 1.5 1.8.7 2.7-1.8 1.2 3.3.3 5-.4 6.3-.8 1.4-1 3.2.5 3.2 2.8 0 3-4.2 4.2-4.2v28.9zM98 614.7v22.1h2.5v-22.1c-.9-.5-1.7-.5-2.5 0z"/>
        <path d="M98.2 629c3.1 1.6 6.2 3.5 7 7.8h-7zm43.2-6.6v14.4h2v-14.4c-.6-.3-1.5-.4-2 0z"/>
        <path d="M143.4 629c-3.1 1.5-6.2 3.3-7 7.7h7zm-20.6-33.7 1.8-1.5v-2c-.6 0-1 .3-1.5 1a5 5 0 0 0-2.5-3 5 5 0 0 0-2.6 2.9c-.5-.7-.8-.8-1.5-1v2l1.8 1.6z"/>
        <path d="m123.8 600.2.8-1.9v-2.5c-.6 0-1 .3-1.5 1a5 5 0 0 0-2.5-3 5 5 0 0 0-2.6 2.9c-.5-.7-.8-.8-1.5-.9v2.5l.8 1.9z"/>
        <path d="m124 606.8 2.6-3.3v-3.2c-1 0-1.5.5-2.2 1.6-.7-2.3-2-2.7-3.8-3.8-1.9 1-3.2 1.5-3.8 3.7-.8-1.1-1.3-1.4-2.3-1.5v3.2l2.7 3.3z"/>
        <path d="M124.7 613.3s3.2-2.7 3.3-4.2v-3.5c-1.2.1-2.3.4-3.2 1.9-.8-2.9-2-3.7-4.2-5-2.3 1.3-3.5 2.1-4.2 5-1-1.5-2-1.8-3.3-2v3.6a15 15 0 0 0 3.3 4.2z"/>
        <path d="M126 625.3s4.4-4.7 4.5-6.6v-5.4c-1.6.2-3.2 1.3-4.4 3.6-1-4.5-2.6-7.6-5.5-9.8-3 2.2-4.6 5.3-5.6 9.8-1.2-2.3-2.7-3.4-4.3-3.6v5.4c.3 1.9 4.4 6.6 4.4 6.6z"/>
        <path d="M126 632.4s3.7-3.7 4.5-5.3v-5.4c-1.6.2-3.2 1.3-4.4 3.5a14 14 0 0 0-5.5-9.2c-3 2.2-4.6 4.7-5.6 9.2-1.2-2.2-2.7-3.3-4.3-3.5v5.4c1 1.6 4.4 5.3 4.4 5.3z"/>
        <path d="M127.5 636.6c-1-4.7-2-8.2-7.1-11.7-5.2 3.5-6.1 7-7.2 11.7z"/>
        <path d="M130.2 639.2v-6.8c-2.4 1-4.5 2.3-5.3 3.8-.8-3.8-2.5-5.4-4.6-7.7-2.1 2.3-3.5 4-4.4 7.7-.8-1.5-2.9-2.9-5.2-3.8v6.8z"/>
      </g>
      <use xlink:href="#a" width="100%" height="100%" transform="matrix(-1 0 0 1 390.7 0)"/>
      <path d="M72.7 694.3H318v12.5H72.7zm-6.5 12.5h258.3v12.5H66.2zm19.4-31.3H305v8.1H85.6z"/>
      <path d="M79.2 683.6h232.4v10.6H79.2zm10.2-14.3h212v6.2h-212z"/>
      <path d="M112.4 669.3h16v50h-16z"/>
      <path d="M116 669.3h8.9v50h-9zm71 0h16v50h-16z"/>
      <path d="M190.7 669.3h9v50h-9zm71.5 0h16v50h-16z"/>
      <path d="M265.7 669.3h9v50h-9z"/>
      <path fill="none" d="M99 664.2h193M115.8 713h9.2m-9.2-6.3h9.2m-9.2-6.2h9.2m-9.2-6.3h9.2m-9.2-6.2h9.2m-9.2-6.3h9.2m-9.2-6.2h9.2m65.8 37.5h8.6m-8.6-6.3h8.6m-8.6-6.2h8.6m-8.6-6.3h8.6m-8.6-6.2h8.6m-8.6-6.3h8.6m-8.6-6.2h8.6m66.2 37.5h9.2m-9.2-6.3h9.2m-9.2-6.2h9.2m-9.2-6.3h9.2m-9.2-6.2h9.2m-9.2-6.3h9.2m-9.2-6.2h9.2"/>
    </g>
  </svg>`,
    sanitizeText: (text: string) => {
        text = text.replaceAll('​', '');
        text = text.replaceAll('‌', '');
        return text;
    },
    sanitizePreviewText: (text: string) => {
        text = text.replaceAll(' ', '');
        text = lang.sanitizeText(text);
        return text;
    },
    sanitizeFindingText: (text: string) => {
        // khmer characters from https://en.wikipedia.org/wiki/Khmer_script
        const chars = new Set([
            'ក',
            'ខ',
            'គ',
            'ឃ',
            'ង',
            'ច',
            'ឆ',
            'ជ',
            'ឈ',
            'ញ',
            'ដ',
            'ឋ',
            'ឌ',
            'ឍ',
            'ណ',
            'ត',
            'ថ',
            'ទ',
            'ធ',
            'ន',
            'ប',
            'ផ',
            'ព',
            'ភ',
            'ម',
            'យ',
            'រ',
            'ល',
            'វ',
            'ឝ',
            'ឞ',
            'ស',
            'ហ',
            'ឡ',
            'អ',
            '្',
            'ឣ',
            'ឤ',
            'ឥ',
            'ឦ',
            'ឧ',
            'ឨ',
            'ឩ',
            'ឪ',
            'ឫ',
            'ឬ',
            'ឭ',
            'ឮ',
            'ឯ',
            'ឰ',
            'ឱ',
            'ឲ',
            'ឳ',
            'ា',
            'ិ',
            'ី',
            'ឹ',
            'ឺ',
            'ុ',
            'ូ',
            'ួ',
            'ើ',
            'ឿ',
            'ៀ',
            'េ',
            'ែ',
            'ៃ',
            'ោ',
            'ៅ',
            'ំ',
            'ះ',
            'ៈ',
            '៉',
            '៊',
            '់',
            '៌',
            '៍',
            '៎',
            '៏',
            '័',
            '៑',
            '្',
            '៓',
            '០',
            '១',
            '២',
            '៣',
            '៤',
            '៥',
            '៦',
            '៧',
            '៨',
            '៩',
        ]);
        let newText = '';
        for (const c of text) {
            if (chars.has(c)) {
                newText += c;
            } else {
                newText += ' ';
            }
        }
        newText = newText.replaceAll(/\s+/g, ' ');
        newText = lang.trimText(newText);
        return newText;
    },
    stopWords: [
        'និង',
        'ដែល',
        'ដែរ',
        'ជា',
        'ក្នុង',
        'ទៅ',
        'ពី',
        'ក៏',
        'មិន',
        'បាន',
        'នេះ',
        'មាន',
        'ជា',
    ],
    trimText: (text: string) => {
        return text.trim().replaceAll(/(^(\u200B)+|(\u200B)+$)/g, '');
    },
    endWord: (text: string) => {
        return text + '\u200B';
    },
    extraBibleContextMenuItems: (_bibleItem, _appProvider) => {
        return [];
    },
    bibleAudioAvailable: false,
};

export default lang;
