import type { LanguageDataType } from '../../langHelpers';

import btbBlack from './fonts/Battambang-Black.ttf';
import btbBold from './fonts/Battambang-Bold.ttf';
import btbLight from './fonts/Battambang-Light.ttf';
import btbRegular from './fonts/Battambang-Regular.ttf';
import btbThin from './fonts/Battambang-Thin.ttf';

const numList = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];

const dictionary = {
    'Enable Background Audio Handlers':
        'បើក/បិទ អ្នកគ្រប់គ្រងសំលេងផ្ទៃខាងក្រោយ',
    'Audio is Playing': 'កំពុងលេងសំលេង',
    'Please pause all background audios before disabling audio handlers':
        'សូមបញ្ឈប់សំលេងផ្ទៃខាងក្រោយទាំងអស់មុនពេលបិទអ្នកគ្រប់គ្រងសំលេង',
    'Fading at the End': 'បន្ថយនៅចុងបញ្ចប់',
    'Data not available for': 'ទិន្នន័យមិនអាចใช้ได้สำหรับ',
    'No data available': 'មិនមានទិន្នន័យ',
    'No verses found for this Bible item':
        'មិនមានខគម្ពីរណាមួយសម្រាប់ធាតុព្រះគម្ពីរនេះទេ',
    'Select Default': 'ជ្រើសរើសលំនាំដើម',
    Reset: 'កំណត់ឡើងវិញ',
    'Start Countdown to DateTime': 'ចាប់ផ្តើមរាប់ថយក្រោយទៅកាន់ថ្ងៃម៉ោង',
    'Start Countdown': 'ចាប់ផ្តើមរាប់ថយក្រោយ',
    'Show Marquee': 'បង្ហាញអក្សររត់',
    'Show Quick Text': 'បង្ហាញអក្សរយ៉ាងឆាប់រហ័ស',
    'Start Stopwatch': 'ចាប់ផ្តើមម៉ោងចាប់ពេល',
    'Show Time': 'បង្ហាញម៉ោង',
    Loading: 'កំពុងផ្ទុក',
    'Reload is needed': 'ត្រូវការការផ្ទុកឡើងវិញ',
    'We were sorry, Internal process error, you to refresh the app':
        'យើងខ្ញុំសូមអភ័យទោស កំហុសក្នុងដំណើរការ ខ្ញុំសូមអញ្ជើញអ្នកធ្វើការផ្ទុកឡើងវិញនៃកម្មវិធី',
    Exporting: 'កំពុងបំលែង',
    'Export to MS Word': 'បំលែងទៅឯកសារ MS Word',
    'Fail To Get File List': 'បរាជ័យក្នុងការទទួលបានបញ្ជីឯកសារ',
    'No Files Found': 'មិនមានឯកសារទេ',
    General: 'ទូទៅ',
    Bible: 'ព្រះគម្ពីរ',
    About: 'អារម្មណ៏កថា',
    Presenter: 'ធ្វើបទបង្ហាញ',
    Colors: 'ពណ៌',
    Images: 'រូបភាព',
    Videos: 'វីដេអូ',
    Cameras: 'កាមេរ៉ា',
    Webs: 'វេបសាយ',
    Text: 'អក្សរ',
    Box: 'ប្រអប់',
    Appearance: 'រូបរាង',
    Shadow: 'ស្រមោល',
    Lyric: 'ចំរៀង',
    Slide: 'ស្លាយ',
    Documents: 'ឯកសារ',
    Lyrics: 'អក្សរភ្លេង',
    Playlists: 'តារាងកម្មវិធី',
    Bibles: 'ព្រះគម្ពីរ',
    'Full Text': 'បង្ហាញពេញ',
    'Add Extra Bible': 'បន្ថែមព្រះគម្ពីរ',
    'Add Items': 'បន្ថែម',
    'Add Time': 'បន្ថែមម៉ោង',
    'Advance Bible Lookup': 'ស្វែងរកព្រះគម្ពីរកម្រិតខ្ពស់',
    'Apply All Slides': 'អនុវត្តទៅកាន់គ្រប់ស្លាយ',
    'Apply changed dimension to this slide':
        'អនុវត្តទំហំដែលបានផ្លាស់ប្តូរទៅកាន់ស្លាយនេះ',
    'Apply changed name to this slide':
        'អនុវត្តឈ្មោះដែលបានផ្លាស់ប្តូរទៅកាន់ស្លាយនេះ',
    Apply: 'អនុវត្ត',
    'Are you sure to discard all histories?':
        'តើអ្នកពិតជាចង់បោះបង់ប្រវត្តិទាំងអស់ឬ?',
    'Audio playing': 'កំពុងលេងសំលេង',
    Audios: 'សំលេង',
    'Auto Play Audio AI when available': 'លេងសំលេង AI ដោយស្វ័យប្រវត្តិនៅពេលមាន',
    'Backdrop Filter (PX):': 'Backdrop Filter (PX):',
    'Background Color:': 'ពណ៌ផ្ទៃខាងក្រោយ:',
    'Background Images Slide Show': 'ការបង្ហាញស្លាយរូបភាពផ្ទៃខាងក្រោយ',
    'Bible key': 'កូនសោរព្រះគម្ពីរ',
    'Bible Lookup': 'ស្វែងរកព្រះគម្ពីរ',
    'Camera Show': 'បង្ហាញកាមេរ៉ា',
    'Change Bible Model Info': 'ផ្លាស់ប្តូរព័ត៌មានគំរូព្រះគម្ពីរ',
    'Clear All Settings': 'លុបការកំណត់ទាំងអស់',
    'Clear All': 'លុបទាំងអស់',
    'Clear Background': 'លុបផ្ទៃខាងក្រោយ',
    'Clear Bible': 'លុបព្រះគម្ពីរ',
    'Clear Cache': 'លុប Cache',
    'Clear Color Note': 'លុបកំណត់សម្គាល់ពណ៌',
    'Clear Foreground': 'លុបផ្ទៃខាងមុខ',
    'Clear Slide': 'លុបស្លាយ',
    Clear: 'លុប',
    'Click to change Stage Number': 'ចុចដើម្បីផ្លាស់ប្តូរលេខដំណាក់កាល',
    'Copy All Items': 'ចម្លងធាតុទាំងអស់',
    'Copy All': 'ចម្លងទាំងអស់',
    'Copy Chapter Full Key': 'ចម្លងកូនសោរពេញជំពូក',
    'Copy Selected Text': 'ចម្លងអត្ថបទដែលបានជ្រើសរើស',
    'Copy Text': 'ចម្លងអក្សរ',
    'Copy Title': 'ចម្លងចំណងជើង',
    'Copy Verse Full Key': 'ចម្លងកូនសោរពេញខគម្ពីរ',
    Copy: 'ចម្លង',
    Countdown: 'រាប់ថយក្រោយ',
    'Create Anthropic api key': 'បង្កើត Anthropic api key',
    'Create New File': 'បង្កើតឯកសារថ្មី',
    'Create OpenAI api key': 'បង្កើត OpenAI api key',
    'Creating Default Folder': 'កំពុងបង្កើតថតលំនាំដើម',
    Dark: 'ងងឹត',
    Decrement: 'បន្ថយ',
    'Define a Bible key': 'កំណត់កូនសោរព្រះគម្ពីរ',
    Delete: 'លុប',
    'Dictionary for Selected Text': 'វចនានុក្រមសម្រាប់អត្ថបទដែលបានជ្រើសរើស',
    'Discard changed': 'បោះបង់ការផ្លាស់ប្តូរ',
    'Download From URL': 'ទាញយកពី URL',
    Download: 'ទាញយក',
    Duplicate: 'ស្ទួន',
    'Edit Parent Path': 'កែសម្រួលផ្លូវមេ',
    'Edit this web file': 'កែសម្រួលឯកសារគេហទំព័រនេះ',
    Edit: 'កែសម្រួល',
    'edit-item-thumb': 'edit-item-thumb',
    Editor: 'កម្មវិធីកែសម្រួល',
    Empty: 'ទទេ',
    'Exit Full': 'ចាកចេញពីពេញ',
    'Font Family': 'ពុម្ពអក្សរ',
    Foreground: 'ផ្ទៃខាងមុខ',
    'Full Width': 'ទទឹងពេញ',
    Full: 'ពេញ',
    'Generated using AI technology.': 'បង្កើតដោយប្រើបច្ចេកវិទ្យា AI',
    'Generated using Google Translate.': 'បង្កើតដោយប្រើ Google Translate',
    'Go Back to Presenter': 'ត្រឡប់ទៅកម្មវិធីបង្ហាញ',
    'Go to Bible Setting': 'ទៅកាន់ការកំណត់ព្រះគម្ពីរ',
    'Or add bible ': 'ឬបន្ថែមព្រះគម្ពីរ',
    'Go to Settings': 'ទៅកាន់ការកំណត់',
    'Hide Camera': 'លាក់កាមេរ៉ា',
    'Hide Countdown': 'លាក់ការរាប់ថយក្រោយ',
    'Hide Editor': 'លាក់កម្មវិធីកែសម្រួល',
    'Hide Marquee': 'លាក់អក្សររត់',
    'Hide Quick Text': 'លាក់អត្ថបទរហ័ស',
    'Hide Stopwatch': 'លាក់នាឡិកាបញ្ឈប់',
    'Hide Time': 'លាក់ម៉ោង',
    'Hide Web': 'លាក់គេហទំព័រ',
    Import: 'នាំចូល',
    Increment: 'បន្ថែម',
    'Insert Image or Video': 'បញ្ចូលរូបភាព ឬវីដេអូ',
    'Invalid Path': 'ផ្លូវមិនត្រឹមត្រូវ',
    'Key is missing': 'បាត់កូនសោរ',
    Language: 'ភាសា',
    'Learn More About Web Development':
        'ស្វែងយល់បន្ថែមអំពីការអភិវឌ្ឍន៍គេហទំព័រ',
    Light: 'ភ្លឺ',
    Lookup: 'រកមើល',
    'Markdown Music Help': 'ជំនួយតន្ត្រី Markdown',
    Marquee: 'អក្សររត់',
    'Mix Color:': 'លាយពណ៌:',
    'Move All Items To': 'ផ្លាស់ទីធាតុទាំងអស់ទៅ',
    'Move backward': 'ផ្លាស់ទីទៅក្រោយ',
    'Move down': 'ផ្លាស់ទីចុះក្រោម',
    'Move forward': 'ផ្លាស់ទីទៅមុខ',
    'Move to Trash': 'ផ្លាស់ទីទៅធុងសំរាម',
    'Move To': 'ផ្លាស់ទីទៅ',
    'Move up': 'ផ្លាស់ទីឡើងលើ',
    'New File Name': 'ឈ្មោះឯកសារថ្មី',
    'New File': 'ឯកសារថ្មី',
    'No App Document Selected': 'មិនមានឯកសារកម្មវិធីត្រូវបានជ្រើសរើសទេ',
    'No Bible Available': 'មិនមានព្រះគម្ពីរទេ',
    'No canvas item selected': 'មិនមានធាតុផ្ទាំងក្រណាត់ត្រូវបានជ្រើសរើសទេ',
    'No Color': 'គ្មានពណ៌',
    'No Lyric Selected': 'មិនមានបទចម្រៀងត្រូវបានជ្រើសរើសទេ',
    'No Parent Directory Selected': 'មិនមានថតមេត្រូវបានជ្រើសរើសទេ',
    'Not Full Width': 'មិនពេញទទឹង',
    'Numbers map': 'ផែនទីលេខ',
    'On Screen Width:': 'ទទឹងលើអេក្រង់:',
    'Opacity (%)': 'ភាពស្រអាប់ (%)',
    'Opacity:': 'ភាពស្រអាប់:',
    'Open in Cross Reference': 'បើកនៅក្នុងឯកសារយោងឆ្លង',
    'Open Shared Link': 'បើកតំណដែលបានចែករំលែក',
    Open: 'បើក',
    'Original Size': 'ទំហំដើម',
    'Other General Options': 'ជម្រើសទូទៅផ្សេងទៀត',
    'Parent Directory:': 'ថតមេ:',
    'Parse Markup String (HTML|XML)': 'ញែកខ្សែអក្សរ Markup (HTML|XML)',
    'Paste Image': 'បិទភ្ជាប់រូបភាព',
    Paste: 'បិទភ្ជាប់',
    'Path Settings': 'ការកំណត់ផ្លូវ',
    'Please select an item to edit': 'សូមជ្រើសរើសធាតុដើម្បីកែសម្រួល',
    'Please stop the audio before leaving the page.':
        'សូមបញ្ឈប់សំលេងមុនពេលចាកចេញពីទំព័រ។',
    Properties: 'លក្ខណសម្បត្តិ',
    'Quick Edit': 'កែសម្រួលរហ័ស',
    'Quick Text': 'អត្ថបទរហ័ស',
    Refresh: 'ផ្ទុកឡើងវិញ',
    Remove: 'លុបចេញ',
    'Repeat this audio': 'ធ្វើសំលេងនេះម្តងទៀត',
    'Reset All Child Directories': 'កំណត់ថតកូនទាំងអស់ឡើងវិញ',
    'Reset Rotate': 'កំណត់ការបង្វិលឡើងវិញ',
    'Reset to default display dimension': 'កំណត់ទៅវិមាត្របង្ហាញលំនាំដើម',
    'Reset Widgets Size': 'កំណត់ទំហំ Widgets ឡើងវិញ',
    'Round (%)': 'មូល (%)',
    'Round Size %:': 'ទំហំមូល %:',
    'Round Size Pixel:': 'ទំហំមូល Pixel:',
    'Save bible item and show on screen':
        'រក្សាទុកធាតុព្រះគម្ពីរហើយបង្ហាញនៅលើអេក្រង់',
    'Save bible item': 'រក្សាទុកធាតុព្រះគម្ពីរ',
    Save: 'រក្សាទុក',
    Scale: 'មាត្រដ្ឋាន',
    'Scale:': 'មាត្រដ្ឋាន:',
    'Search in Bible Search': 'ស្វែងរកក្នុងការស្វែងរកព្រះគម្ពីរ',
    'Search Selected Text on Google': 'ស្វែងរកអត្ថបទដែលបានជ្រើសរើសនៅលើ Google',
    'Select Default Folder': 'ជ្រើសរើសថតលំនាំដើម',
    'Set OpenAI API Key for Audio AI': 'កំណត់ OpenAI API Key សម្រាប់ Audio AI',
    Setting: 'ការកំណត់',
    'shift + click to append': 'shift + click ដើម្បីបន្ថែមចុងក្រោយ',
    'Shift Click to Add': 'Shift Click ដើម្បីបន្ថែម',
    'Show all verses': 'បង្ហាញខគម្ពីរទាំងអស់',
    'Show bible item': 'បង្ហាញធាតុព្រះគម្ពីរ',
    'Show Editor': 'បង្ហាញកម្មវិធីកែសម្រួល',
    Show: 'បង្ហាញ',
    'Split horizontal': 'បំបែកផ្ដេក',
    'Split Horizontal': 'បំបែកផ្ដេក',
    'Split vertical': 'បំបែកបញ្ឈរ',
    'Stage:': 'ដំណាក់កាល:',
    Stopwatch: 'នាឡិកាបញ្ឈប់',
    Strip: 'ដកចេញ',
    System: 'ប្រព័ន្ធ',
    'Text Color:': 'ពណ៌អក្សរ:',
    Theme: 'ស្បែក',
    'There is no parent directory selected': 'មិនមានថតមេត្រូវបានជ្រើសរើសទេ',
    'This will change all Slides': 'នេះនឹងផ្លាស់ប្តូរស្លាយទាំងអស់',
    'Time Second Delay:': 'ការពន្យារពេល (វិនាទី):',
    'Time Second to Live:': 'ពេលវាលាផ្សាយផ្ទាល់ (វិនាទី):',
    Time: 'ម៉ោង',
    'Toggle Fading at End': 'បិទ/បើក ការបន្ថយនៅចុងបញ្ចប់',
    'Toggle is video should fade at the end':
        'បិទ/បើក ថាតើវីដេអូគួរតែបន្ថយនៅចុងបញ្ចប់',
    'Toggle Wrap Text': 'បិទ/បើក រុំអត្ថបទ',
    'Transition:': 'ការផ្លាស់ប្តូរ:',
    'Unsupported file type!': 'ប្រភេទឯកសារមិនត្រូវបានគាំទ្រ!',
    'Web Show': 'ការបង្ហាញគេហទំព័រ',
    'Width (%)': 'ទទឹង (%)',
    'Width (%):': 'ទទឹង (%):',
    'Will reload the app to apply settings':
        'នឹងផ្ទុកកម្មវិធីឡើងវិញដើម្បីអនុវត្តការកំណត់',
    'Slide Editor': 'កែសម្រួលស្លាយ',
    'Bible Reader': 'អានព្រះគម្ពីរ',
    'Add Bible Item': 'បន្ថែមខព្រះគម្ពីរ',
    'Font Size': 'ទំហំតួអក្សរ',
    'Keep Open': 'កុំបិត',
    'Should New Lines': 'គួរតែបង្កើតបន្ទាត់ថ្មី',
    'Use Model New Lines': 'ប្រើបន្ទាត់ថ្មីគំរូ',
    'Break lines following model formatting': 'បំបែកបន្ទាត់តាមរចនាប័ទ្មគំរូ',
    '(dev)Experiment': '(dev)ការសាកល្បង',
    'Video will fade at the end while screen rendering.':
        'វីដេអូ​នឹង​បន្ថយ​នៅ​ចុង​បញ្ចប់ ខណៈ​ពេល​កំពុង​បង្ហាញ​អេក្រង់។',
    'Apply Settings': 'អនុវត្តការកំណត់',
    Khmer: 'ភាសាខ្មែរ',
    English: 'ភាសាអង់គ្លេស',
    Background: 'ផ្ទៃខាងក្រោយ',
    'Slide transition': 'ការផ្លាស់ប្តូរស្លាយ',
    'Background transition': 'ការផ្លាស់ប្តូរផ្ទៃខាងក្រោយ',
    'Clear input': 'លុបទិន្នន័យកំពុងបញ្ចូល',
    'Clear input chunk': 'លុបផ្នែកទិន្នន័យកំពុងបញ្ចូល',
    'Keep popup modal open when adding a bible item, useful in presenter mode':
        'រក្សាទុកផ្ទាំងបង្ហាញពហុមុខងារឱ្យបើកនៅពេលបន្ថែមធាតុព្រះគម្ពីរ មានប្រយោជន៍នៅក្នុងរបៀបកម្មវិធីបង្ហាញ',
    'Canvas Items': 'ធាតុផ្ទាំង',
    'Please change bible key here': 'សូមផ្លាស់ប្តូរកូនសោរព្រះគម្ពីរនៅទីនេះ',
    'Not available': 'មិនមាន',
    'Moving File to Trash': 'កំពុងផ្លាស់ទីឯកសារទៅធុងសំរាម',
    'Are you sure you want to move': 'តើអ្នកពិតជាចង់ផ្លាស់ទី',
    'to trash?': 'ទៅធុងសំរាម?',
    Yes: 'យល់ព្រម',
    No: 'ទេ',
    'will be converted to PDF into': 'នឹងត្រូវបានបម្លែងទៅជា PDF ទៅក្នុង',
};
const fontFamily = 'km-font-family';
const lang: LanguageDataType = {
    locale: 'km-KH',
    langCode: 'km',
    fontFamilyName: 'Battambang',
    getFontFamilyFiles: () => {
        return [btbRegular, btbBold, btbLight, btbThin, btbBlack];
    },
    genCss: () => {
        return `
        @font-face {
            font-family: ${fontFamily};
            src: url(${btbRegular}) format("truetype");
        }
        @font-face {
            font-family: ${fontFamily};
            src: url(${btbBold}) format("truetype");
            font-weight: bold;
        }
        @font-face {
            font-family: ${fontFamily};
            src: url(${btbLight}) format("truetype");
            font-weight: 300;
        }
        @font-face {
            font-family: ${fontFamily};
            src: url(${btbThin}) format("truetype");
            font-weight: 100;
        }
        @font-face {
            font-family: ${fontFamily};
            src: url(${btbBlack}) format("truetype");
            font-weight: 900;
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
