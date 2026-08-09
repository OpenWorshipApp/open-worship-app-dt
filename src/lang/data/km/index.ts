import { EditorPluginKmKh } from 'open-lyric-plugin-km-kh';

import {
    genOpenLyricFontFaces,
    type LanguageDataType,
} from '../../langHelpers';
import { resolveGzBundleFilePath } from '../../gzBundleFilePath';

import btbBlack from './fonts/Battambang/Battambang-Black.ttf';
import btbBold from './fonts/Battambang/Battambang-Bold.ttf';
import btbLight from './fonts/Battambang/Battambang-Light.ttf';
import btbRegular from './fonts/Battambang/Battambang-Regular.ttf';
import btbThin from './fonts/Battambang/Battambang-Thin.ttf';
import fhRegular from './fonts/Fasthand/Fasthand-Regular.ttf';

import bibleBooks from './bibleBooks.json';
import bbCR from './bb-cr.gz.bundle';

const numMap = {
    '០': '0',
    '១': '1',
    '២': '2',
    '៣': '3',
    '៤': '4',
    '៥': '5',
    '៦': '6',
    '៧': '7',
    '៨': '8',
    '៩': '9',
};
const numList = Object.keys(numMap);

const dictionary = {
    'Are you sure you want to clear all settings?':
        'តើអ្នកពិតជាចង់លុបការកំណត់ទាំងអស់ឬ?',
    'Reveal Original': 'បង្ហាញកន្លែងដើម',
    Sort: 'តម្រៀប',
    Type: 'ប្រភេទ',
    Default: 'លំនាំដើម',
    'All Types': 'គ្រប់ប្រភេទ',
    'Filter by name': 'ត្រងតាមឈ្មោះ',
    'Filter by Type': 'ត្រងតាមប្រភេទ',
    'No matching files': 'រកមិនឃើញឯកសារដែលត្រូវគ្នា',
    'This folder is empty': 'ថតឯកសារនេះទទេ',
    Dimensions: 'វិមាត្រ',
    'Exporting DOCX Pages': 'កំពុងបម្លែងទំព័រ DOCX ទៅជា HTML',
    'Please wait while the DOCX pages are being exported...':
        'សូមរង់ចាំ ខណៈពេលទំព័រ DOCX កំពុងត្រូវបានបម្លែង...',
    'Exporting PPTX Slides': 'កំពុងបម្លែងស្លាយ PPTX ទៅជា HTML',
    'Please wait while the slides are being exported...':
        'សូមរង់ចាំ ខណៈពេលស្លាយកំពុងត្រូវបានបម្លែង...',
    'Open Bible Reader in a new window':
        'បើកកម្មវិធីអានព្រះគម្ពីរនៅក្នុងវីនដូថ្មី',
    'Open Slide Editor in a new window':
        'បើកកម្មវិធីកែសម្រួលស្លាយនៅក្នុងវីនដូថ្មី',
    'Edit Title': 'កែសម្រួលចំណងជើង',
    'Create KJV Bible XML': 'បង្កើតឯកសារ XML ព្រះគម្ពីរ KJV',
    'Remove URL': 'លុប URL',
    'Copy URL to Clipboard': 'ចម្លង URL ទៅកាន់ក្តារចុច',
    'Add URL': 'បន្ថែម URL',
    'Add New Bible': 'បន្ថែមព្រះគម្ពីរថ្មី',
    'Insert Collapse Bible Text': 'បញ្ចូលអត្ថបទព្រះគម្ពីរដែលបើនបាន',
    'Insert Bible Text': 'បញ្ចូលអត្ថបទព្រះគម្ពីរ',
    'Insert bible item into selected slide':
        'បញ្ចូលធាតុព្រះគម្ពីរទៅក្នុងស្លាយដែលបានជ្រើសរើស',
    'Insert bible item': 'បញ្ចូលធាតុព្រះគម្ពីរ',
    'Choose DOCX Preview Background (right click to clear)':
        'ជ្រើសរើសផ្ទៃខាងក្រោយសម្រាប់មើលជាមុន DOCX (ចុចស្ដាំដើម្បីលុប)',
    'Open DOCX': 'បើក DOCX',
    'Refresh DOCX Pages': 'ផ្ទុកទំព័រ DOCX ជាថ្មី',
    'Delete Note Item': 'លុបធាតុកំណត់សម្គាល់',
    'Are you sure to delete this note item?':
        'តើអ្នកពិតជាចង់លុបធាតុកំណត់សម្គាល់នេះឬ?',
    'Double click to open note': 'ចុចពីរដងដើម្បីបើកកំណត់ត្រា',
    'Reset Selected Books': 'កំណត់សៀវភៅដែលបានជ្រើសរើសឡើងវិញ',
    'Fail to reset search data, please try again':
        'មិនអាចកំណត់ទិន្នន័យស្វែងរកឡើងវិញបាន, សូមព្យាយាមម្តងទៀត',
    'Reset Search Data': 'កំណត់ទិន្នន័យស្វែងរកឡើងវិញ',
    'Are you sure to reset search data? This will take a moment to restore':
        'តើអ្នកពិតជាចង់កំណត់ទិន្នន័យស្វែងរកឡើងវិញឬ? នេះនឹងចំណាយពេលមួយដើម្បីស្ដារឡើងវិញ',
    'This slide is disabled': 'ស្លាយនេះត្រូវបានបិទ',
    'This item is disabled': 'ធាតុនេះត្រូវបានបិទ',
    // What a damaged run-sheet entry reads as, both on its own row and in the
    // toast raised when the file was parsed.
    'Invalid item': 'ធាតុមិនត្រឹមត្រូវ',
    'This item is disabled in this presenting flow':
        'ធាតុនេះត្រូវបានបិទនៅក្នុងតារាងកម្មវិធីនេះ',
    'This item is disabled in its document':
        'ធាតុនេះត្រូវបានបិទនៅក្នុងឯកសាររបស់វា',
    'Double click to jump to top': 'ចុចពីរដងដើម្បីទៅកាន់ខាងលើ',
    'Refresh PPTX Slides': 'ផ្ទុកស្លាយ PPTX ជាថ្មី',
    'Open PPTX': 'បើក PPTX',
    'No Compatible Update Found': 'មិនមានការធ្វើបច្ចុប្បន្នភាពដែលអាចប្រើបាន',
    'Sorry, we could not find a compatible update for your system.':
        'សូមអភ័យទោស, យើងមិនអាចរកឃើញការធ្វើបច្ចុប្បន្នភាពដែលអាចប្រើបានសម្រាប់ប្រព័ន្ធរបស់អ្នក។',
    'On Top': 'នៅកំពូល',
    'Corrupted Document': 'ឯកសារបាក់បែក',
    'The document data is corrupted and cannot be loaded. We will reset the document data to a new state.':
        'ទិន្នន័យឯកសារបាក់បែក និងមិនអាចផ្ទុកបាន។ យើងនឹងកំណត់ឡើងវិញទិន្នន័យឯកសារទៅស្ថានភាពថ្មី។',
    'Something wrong during converting, please try again.':
        'មានបញ្ហាពេលកំពុងបម្លែង, សូមព្យាយាមម្តងទៀត។',

    'Something wrong during converting, please check converted file':
        'មានបញ្ហាពេលកំពុងបម្លែង, សូមពិនិត្យឯកសារដែលបានបម្លែង',
    'and try again.': 'ហើយព្យាយាមម្តងទៀត។',
    'Error occurred during copying file': 'មានបញ្ហាពេលកំពុងចម្លងឯកសារ',
    'Trashing File': 'ផ្លាស់ទីឯកសារទៅធុងសំរាម',
    'Unable to trash file. Please try again.':
        'មិនអាចផ្លាស់ទីឯកសារទៅធុងសំរាមបានទេ។ សូមព្យាយាមម្តងទៀត។',
    'Copy to Clipboard': 'ចម្លងទៅកាន់ក្តារចុច',
    'Getting File List': 'កំពុងទទួលបានបញ្ជីឯកសារ',
    'Error occurred during listing file': 'មានបញ្ហាពេលកំពុងទទួលបានបញ្ជីឯកសារ',
    'Unset Directory Path': 'បោះបង់ផ្លូវថត',
    'Empty Bible List': 'បញ្ជីព្រះគម្ពីរទទេ',
    'Empty Note List': 'បញ្ជីកំណត់សម្គាល់ទទេ',
    'Are you sure to empty this note list?':
        'តើអ្នកពិតជាចង់ទទេបញ្ជីកំណត់សម្គាល់នេះឬ?',
    'Are you sure to empty this bible list?':
        'តើអ្នកពិតជាចង់ទទេបញ្ជីព្រះគម្ពីរនេះឬ?',
    'Confirm Key for Bible': 'បញ្ជាក់កូនសោរព្រះគម្ពីរ',
    'Are you sure you want to quit?': 'តើអ្នកពិតជាចង់ចាកចេញឬ?',
    'Do you want to continue with': 'តើអ្នកចង់បន្តជាមួយ',
    'Search XML': 'ស្វែងរក XML',
    'Downloading in progress': 'កំពុងទាញយក',
    "Can't leave the page while downloading.":
        'មិនអាចចាកចេញពីទំព័រនេះបានទេ ខណៈពេលកំពុងទាញយក។',
    'Please wait until the download is complete.':
        'សូមរង់ចាំរហូតដល់ការទាញយកបានបញ្ចប់។',
    'Or attempt 3 times to force leaving.': 'ឬព្យាយាម 3 ដងដើម្បីបង្ខំចាកចេញ។',
    'Download Completed': 'ការទាញយកបានបញ្ចប់',
    'The update has been downloaded. Do you want to open the file location?':
        'ការធ្វើបច្ចុប្បន្នភាពត្រូវបានទាញយក។ តើអ្នកចង់បើកទីតាំងឯកសារទេ?',
    'Error occurred during download': 'មានបញ្ហាពេលកំពុងទាញយក',
    Error: 'បញ្ហា',
    'Import XML File': 'នាំចូលឯកសារ XML',
    'XML format example': 'ឧទាហរណ៍ទ្រង់ទ្រាយ XML',
    'Renaming File': 'កំពុងប្ដូរឈ្មោះឯកសារ',
    'Unable to rename file': 'មិនអាចប្ដូរឈ្មោះឯកសារបាន',
    'No Bible XML files': 'មិនមានឯកសារ XML ព្រះគម្ពីរទេ',
    'Bibles XML': 'ព្រះគម្ពីរជា XML',
    'Update Available': 'អាចធ្វើបច្ចុប្បន្នភាពបាន',
    'A new version of the app is available': 'មានកំណែថ្មីនៃកម្មវិធី',
    'Would you like to download it?': 'តើអ្នកចង់ទាញយកវាទេ?',
    'You can go to download page.': 'អ្នកអាចទៅកាន់ទំព័រទាញយក',
    'Go to Download Page': 'ទៅកាន់ទំព័រទាញយក',
    'Screen Manager is locked': 'កម្មវិធីគ្រប់គ្រងអេក្រង់ត្រូវបានចាក់សោ',
    'No Update Needed': 'មិនមានការធ្វើបច្ចុប្បន្នភាពទេ',
    'You are using the latest version of the app.':
        'អ្នកកំពុងប្រើកំណែថ្មីបំផុតនៃកម្មវិធី',
    'Please unlock the screen manager to change the app document':
        'សូមបើកសោកម្មវិធីគ្រប់គ្រងអេក្រង់ដើម្បីផ្លាស់ប្តូរឯកសារកម្មវិធី',
    'Background Images': 'រូបភាពផ្ទៃខាងក្រោយ',
    'Background Videos': 'វីដេអូផ្ទៃខាងក្រោយ',
    'Background Audios': 'សម្លេងផ្ទៃខាងក្រោយ',
    'Background Webs': 'វេបសាយផ្ទៃខាងក្រោយ',
    'Bible Present': 'បង្ហាញព្រះគម្ពីរ',
    'Click here to set default data on "Desktop"':
        'ចុចទីនេះដើម្បីកំណត់ទិន្នន័យលំនាំដើមនៅលើ "Desktop"',
    'Unable to get online bible list': 'មិនអាចទទួលបានបញ្ជីព្រះគម្ពីរអនឡាញ',
    'Fail to get find controller!': 'មិនអាចទទួលបានកម្មវិធីស្វែងរក!',
    'No slides to display': 'មិនមានស្លាយដែលត្រូវបង្ហាញទេ',
    'Fail to load slides': 'មិនអាចផ្ទុកស្លាយបាន',
    'Reset Size': 'កំណត់ទំហំឡើងវិញ',
    'Close First Widget': 'បិទផ្ទាំងទីមួយ',
    'Close Second Widget': 'បិទផ្ទាំងទីពីរ',
    'Missing Fonts in': 'អក្សរខ្វះនៅក្នុង',
    'The document is using fonts that are not installed on your system':
        'ឯកសារនេះកំពុងប្រើអក្សរដែលមិនបានដំឡើងនៅលើប្រព័ន្ធរបស់អ្នក',
    'Would you like to search for the missing fonts?':
        'តើអ្នកចង់ស្វែងរកពុម្ពអក្សរដែលបាត់ឫទេ?',
    ['Please install the missing fonts from the opened pages. and ' +
    'restart the app after installation.']:
        'សូមដំឡើងអក្សរដែលបាត់ពីទំព័រដែលបានបើក ហើយចាប់ផ្តើមកម្មវិធីឡើងវិញបន្ទាប់ពីការដំឡើង',
    'Opening Missing Fonts Searching': 'កំពុងស្វែងរកអក្សរដែលបាត់',
    'Open BibleNote': 'បើកកំណត់ត្រាព្រះគម្ពីរ',
    'No title': 'គ្មានចំណងជើង',
    'Background and Color': 'ផ្ទៃខាងក្រោយ និងពណ៌',
    'The current text color may not be visible with the new background color.':
        'ពណ៌អក្សរបច្ចុប្បន្នអាចមិនមើលឃើញជាមួយពណ៌ផ្ទៃខាងក្រោយថ្មី',
    'Do you want to change the text color as well?':
        'តើអ្នកចង់ប្ដូរពណ៌អក្សរផងដែរ?',
    'Fail to create folder': 'មិនអាចបង្កើតថតបាន',
    'New Note Item': 'បង្កើតកំណត់ត្រាថ្មី',
    'This will select': 'នេះនឹងជ្រើសរើស',
    'will create if not exist': 'នឹងបង្កើតឡើងប្រសិនបើមិនមាន',
    'No directory selected': 'មិនមានថតដែលបានជ្រើស',
    Notes: 'កំណត់ត្រា',
    Note: 'កំណត់ត្រា',
    'Bible Notes': 'កំណត់ត្រាព្រះគម្ពីរ',
    'Bible and Notes': 'ព្រះគម្ពីរ និងកំណត់ត្រា',
    'Document List': 'បញ្ជីឯកសារ',
    'Lyric List': 'បញ្ជីអក្សរភ្លេង',
    'Presenting Flow List': 'បញ្ជីតារាងកម្មវិធី',
    Previewer: 'កម្មវិធីមើលជាមុន',
    Slides: 'ស្លាយ',
    'Slide Editor Ground': 'តំបន់កែសម្រួលស្លាយ',
    'Slide Editor Canvas': 'ផ្ទាំងកែសម្រួលស្លាយ',
    Tools: 'ឧបករណ៍',
    'App Editor Left': 'កម្មវិធីកែសម្រួល ខាងឆ្វេង',
    'App Editor Right': 'កម្មវិធីកែសម្រួល ខាងស្តាំ',
    'App Presenter Left': 'ធ្វើបទបង្ហាញ ខាងឆ្វេង',
    'App Presenter Middle': 'ធ្វើបទបង្ហាញ កណ្តាល',
    'App Presenter Right': 'ធ្វើបទបង្ហាញ ខាងស្តាំ',
    'Mini Screen': 'អេក្រង់តូច',
    'Bible View': 'ទិដ្ឋភាពព្រះគម្ពីរ',
    'Bible Online Lookup': 'ស្វែងរកព្រះគម្ពីរតាមអ៊ីនធឺណិត',
    'Background Audio': 'សំលេងផ្ទៃខាងក្រោយ',
    'Stage Previewer': 'អ្នកមើលជាមុនដំណាក់កាល',
    stages: 'ដំណាក់កាល',
    'Add Stage': 'បន្ថែមស្ទែជ',
    'Remove Stage': 'លុបស្ទែជចេញ',
    'Base Stage': 'ស្ទែជគោល',
    'Base stage is always shown': 'ស្ទែជគោលតែងតែបង្ហាញ',
    'Add another stage layout': 'បន្ថែមប្លង់ស្ទែជមួយទៀត',
    'All stage layouts are shown': 'ប្លង់ស្ទែជទាំងអស់កំពុងបង្ហាញ',
    'Stage Style': 'រចនាប័ទ្មស្ទែជ',
    'Reset Stage Style': 'កំណត់រចនាប័ទ្មស្ទែជឡើងវិញ',
    'Applies to every song': 'អនុវត្តលើបទចម្រៀងទាំងអស់',
    'Slide Padding (%)': 'គម្លាតស្លាយ (%)',
    'Background Opacity (%)': 'ភាពស្រអាប់ផ្ទៃខាងក្រោយ (%)',
    'Extra Font Size': 'ទំហំអក្សរបន្ថែម',
    'Custom CSS': 'CSS ផ្ទាល់ខ្លួន',
    'Custom CSS is added after this stage own style':
        'CSS ផ្ទាល់ខ្លួនត្រូវបានបន្ថែមក្រោយរចនាប័ទ្មរបស់ស្ទែជនេះ',
    'Browser does not support audio.': 'កម្មវិធីរុករកមិនគាំទ្រសំលេងទេ។',
    'Not Supported Item Type': 'ប្រភេទធាតុដែលមិនគាំទ្រ',
    'Fail to read file data': 'មិនអាចទទួលបានទិន្នន័យពីឯកសារ',
    'No book options available': 'មិនមានជម្រើសសៀវភៅទេ',
    'Fail to get data': 'មិនអាចទទួលបានទិន្នន័យ',
    'All Books': 'សៀវភៅទាំងអស់',
    'Shift + Click to select multiple': 'Shift + ចុច ដើម្បីជ្រើសរើសច្រើន',
    'Old Testament': 'សញ្ញាចាស់',
    'New Testament': 'សញ្ញាថ្មី',
    Find: 'ស្វែងរក',
    'Cross Reference': 'ខគម្ពីរយោង',
    'Cross References': 'ខគម្ពីរយោង',
    'Reveal in File Explorer': 'បើកក្នុងកម្មវិធីរុករកឯកសារ',
    'Saving note': 'កំពុងរក្សាទុកកំណត់សម្គាល់',
    'Please wait while the note is being saved.':
        'សូមរង់ចាំ ខណៈដែលកំណត់សម្គាល់កំពុងត្រូវបានរក្សាទុក',
    'Enter your note here': 'បញ្ចូលកំណត់សម្គាល់របស់អ្នកនៅទីនេះ',
    'Slide is copied': 'ស្លាយត្រូវបានចម្លង',
    'Remove Background': 'លុបផ្ទៃខាងក្រោយ',
    'Timezone Minute Offset': 'ការបន្ថែម/បញ្ចូលនាទីតំបន់ពេលវេលា',
    'Choose Color': 'ជ្រើសរើសពណ៌',
    'Choose City': 'ជ្រើសរើសទីក្រុង',
    'New Slide': 'ស្លាយថ្មី',
    'Show on Screens': 'បង្ហាញនៅលើអេក្រង់',
    'Set Specific Screen': 'កំណត់អេក្រង់ជាក់លាក់',
    'Remove from screen': 'ដកចេញពីអេក្រង់',
    Rename: 'កែឈ្មោះ',
    Reload: 'ផ្ទុកឡើងវិញ',
    'Set Line Sync': 'កំណត់ការសម្របសម្រួលបន្ទាត់',
    'Unset Line Sync': 'បោះបង់ការសម្របសម្រួលបន្ទាត់',
    Solo: 'តែមួយ',
    Select: 'ជ្រើសរើស',
    Deselect: 'បោះបង់ជ្រើសរើស',
    'Copy Path to Clipboard': 'ចម្លងផ្លូវទៅកាន់ក្តារចុច',
    'Reveal in Finder': 'បង្ហាញនៅក្នុង Finder',
    'Preview PDF': 'មើល PDF',
    'Refresh PDF Images': 'ផ្ទុករូបភាព PDF ជាថ្មី',
    'Add New Screen': 'បន្ថែមអេក្រង់ថ្មី',
    'Refresh Preview': 'ផ្ទុកមើលជាមុន',
    'The application is started first time':
        'កម្មវិធីត្រូវបានចាប់ផ្តើមជាលើកដំបូង',
    Close: 'បិទ',
    'Toggle Widget Full View': 'បិទ/បើក ទិដ្ឋភាពពេញលេញរបស់វីដេអូ',
    'Split Vertical to': 'បំបែកបញ្ឈរទៅ',
    'Split Horizontal to': 'បំបែកផ្ដេកទៅ',
    'Loading Bible Data': 'កំពុងផ្ទុកទិន្នន័យព្រះគម្ពីរ',
    'Unable to preview right now': 'មិនអាចបង្ហាញបាននៅពេលនេះទេ',
    'Open bible lookup popup': 'បើកផ្ទាំងស្វែងរកព្រះគម្ពីរ',
    Cancel: 'បដិសេធ',
    Ok: 'យល់ព្រម',
    'Cancel selection': 'បោះបង់ការជ្រើសរើស',
    'Quick Exit': 'ចាកចេញយ៉ាងឆាប់រហ័ស',
    'Are you sure you want to quit the app?':
        'តើអ្នកពិតជាចង់ចាកចេញពីកម្មវិធីឬ?',
    'Items are copied': 'ធាតុត្រូវបានចម្លង',
    'Only image and video files are supported':
        'គ្រាន់តែឯកសាររូបភាព និងវីដេអូត្រូវបានគាំទ្រ',
    'Insert Medias': 'បញ្ចូលរូបភាព វីដេអូ ឬសំលេង',
    'Insert YouTube': 'បញ្ចូល YouTube',
    'Insert Media Link': 'បញ្ចូលតំណមេឌា',
    'Media URL:': 'តំណមេឌា៖',
    'Insert Website': 'បញ្ចូលគេហទំព័រ',
    'Insert Camera': 'បញ្ចូលកាមេរ៉ា',
    'No camera found': 'រកមិនឃើញកាមេរ៉ា',
    Camera: 'កាមេរ៉ា',
    'Camera Properties': 'លក្ខណៈកាមេរ៉ា',
    'Camera Device': 'ឧបករណ៍កាមេរ៉ា',
    'Camera not found': 'រកមិនឃើញកាមេរ៉ា',
    'Start Camera': 'ចាប់ផ្តើមកាមេរ៉ា',
    'Stop Camera': 'បញ្ឈប់កាមេរ៉ា',
    Preview: 'មើលជាមុន',
    Mirror: 'បញ្ច្រាស',
    'Object Fit': 'របៀបដាក់ឲ្យសម',
    Cover: 'គ្របពេញ',
    Contain: 'ដាក់ទាំងមូល',
    Fill: 'ពង្រីកពេញ',
    'YouTube URL:': 'តំណ YouTube៖',
    'Website URL:': 'តំណគេហទំព័រ៖',
    'Video URL:': 'តំណវីដេអូ៖',
    'Audio URL:': 'តំណសំលេង៖',
    'Image URL:': 'តំណរូបភាព៖',
    'Web URL:': 'តំណវេបសាយ៖',
    'Documents URL:': 'តំណឯកសារ៖',
    'Presenting Flow Archive URL:': 'តំណប័ណ្ណសារតារាងកម្មវិធី៖',
    'Open URL': 'បើកតំណ',
    'Copy URL': 'ចម្លងតំណ',
    New: 'ថ្មី',
    'Slides are copied': 'ស្លាយត្រូវបានចម្លង',
    Copied: 'បានចម្លង',
    'Canvas item copied': 'ធាតុផ្ទាំងបានចម្លង',
    'Enable Background Audio Handlers':
        'បើក/បិទ អ្នកគ្រប់គ្រងសំលេងផ្ទៃខាងក្រោយ',
    'Audio is Playing': 'កំពុងលេងសំលេង',
    'Please pause all background audios before disabling audio handlers':
        'សូមបញ្ឈប់សំលេងផ្ទៃខាងក្រោយទាំងអស់មុនពេលបិទអ្នកគ្រប់គ្រងសំលេង',
    'Fading at the End': 'បន្ថយនៅចុងបញ្ចប់',
    'Data not available for': 'ទិន្នន័យមិនអាចប្រើប្រាស់បាន',
    'No data available': 'មិនមានទិន្នន័យ',
    'No verses found for this Bible item':
        'មិនមានខគម្ពីរណាមួយសម្រាប់ធាតុព្រះគម្ពីរនេះទេ',
    'Select Default': 'ជ្រើសរើសលំនាំដើម',
    Reset: 'កំណត់ឡើងវិញ',
    'Start Countdown to DateTime': 'ចាប់ផ្តើមរាប់ថយក្រោយទៅកាន់ថ្ងៃម៉ោង',
    'Start Countdown': 'ចាប់ផ្តើមរាប់ថយក្រោយ',
    'Show Marquee Top': 'បង្ហាញអក្សររត់ខាងលើ',
    'Show Marquee Bottom': 'បង្ហាញអក្សររត់ខាងក្រោម',
    'Show Quick Text': 'បង្ហាញអក្សរយ៉ាងឆាប់រហ័ស',
    'Start Stopwatch': 'ចាប់ផ្តើមម៉ោងចាប់ពេល',
    'Show Time': 'បង្ហាញម៉ោង',
    Loading: 'កំពុងផ្ទុក',
    'Reload is needed': 'ត្រូវការការផ្ទុកឡើងវិញ',
    'We were sorry, Internal process error, you to refresh the app':
        'យើងខ្ញុំសូមអភ័យទោស កំហុសក្នុងដំណើរការ ខ្ញុំសូមអញ្ជើញអ្នកធ្វើការផ្ទុកឡើងវិញនៃកម្មវិធី',
    Exporting: 'កំពុងបំលែង',
    'Export to MS Word': 'បំលែងទៅឯកសារ MS Word',
    'Exporting Fonts': 'បំលែងពុម្ពអក្សរ',
    'Would you like to export the fonts?': 'តើអ្នកចង់បំលែងពុម្ពអក្សរដែរឬទេ?',
    'Fail to Get File List': 'បរាជ័យក្នុងការទទួលបានបញ្ជីឯកសារ',
    'No Files Found': 'មិនមានឯកសារទេ',
    General: 'ទូទៅ',
    Bible: 'ព្រះគម្ពីរ',
    Others: 'ផ្សេងទៀត',
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
    'Text Shadow': 'ស្រមោលអក្សរ',
    Lyric: 'ចំរៀង',
    Slide: 'ស្លាយ',
    Documents: 'ឯកសារ',
    'Document Audios': 'សំលេងឯកសារ',
    Lyrics: 'អក្សរភ្លេង',
    'Presenting Flows': 'តារាងកម្មវិធី',
    'Presenting Flow': 'តារាងកម្មវិធី',
    'Preview Presenting Flow': 'មើលតារាងកម្មវិធីជាមុន',
    'Open Preview': 'បើកការមើលជាមុន',
    'Open Slides Preview': 'បើកការមើលស្លាយជាមុន',
    'Already showing in the main previewer': 'កំពុងបង្ហាញក្នុងកម្មវិធីមើលមេ',
    'Add Action': 'បន្ថែមសកម្មភាព',
    'Apply on Screens': 'អនុវត្តនៅលើអេក្រង់',
    'Clear Screen': 'លុបអេក្រង់',
    'Clear FG Marquee Top': 'លុប FG អក្សររត់ខាងលើ',
    'Clear FG Marquee Bottom': 'លុប FG អក្សររត់ខាងក្រោម',
    'Clear FG Quick Text': 'លុប FG អត្ថបទរហ័ស',
    'Clear FG Countdown': 'លុប FG រាប់ថយក្រោយ',
    'Clear FG Stopwatch': 'លុប FG នាឡិកាបញ្ឈប់',
    'Clear FG Time': 'លុប FG ម៉ោង',
    'Clear FG Camera Show': 'លុប FG បង្ហាញកាមេរ៉ា',
    'Clear FG Web Show': 'លុប FG ការបង្ហាញគេហទំព័រ',
    'Other Clear FG Items': 'ការលុប FG ផ្សេងទៀត',
    'Screen: Show': 'អេក្រង់៖ បង្ហាញ',
    'Screen: Hide': 'អេក្រង់៖ លាក់',
    'Please choose at least one screen': 'សូមជ្រើសរើសអេក្រង់យ៉ាងតិចមួយ',
    'No screen is open': 'គ្មានអេក្រង់បើកទេ',
    'Slide: Media Control': 'ស្លាយ៖ ការគ្រប់គ្រងមេឌៀ',
    'Add Media Control': 'បន្ថែមការគ្រប់គ្រងមេឌៀ',
    'Media Control Settings': 'ការកំណត់ការគ្រប់គ្រងមេឌៀ',
    Play: 'លេង',
    Pause: 'ផ្អាក',
    Stop: 'បញ្ឈប់',
    Action: 'សកម្មភាព',
    Settings: 'ការកំណត់',
    'Delay Before': 'ពន្យារពេលមុន',
    'Media Start At': 'មេឌៀចាប់ផ្តើមនៅ',
    'Then Pause': 'បន្ទាប់មកផ្អាក',
    Never: 'មិនដែល',
    After: 'បន្ទាប់ពី',
    'At Media Time': 'នៅពេលមេឌៀ',
    'Media Pause At': 'មេឌៀផ្អាកនៅ',
    'Pause After': 'ផ្អាកបន្ទាប់ពី',
    Volume: 'កម្រិតសំឡេង',
    Speed: 'ល្បឿន',
    'Set Volume': 'កំណត់កម្រិតសំឡេង',
    'Set Speed': 'កំណត់ល្បឿន',
    'Please enter a number that is 0 or greater':
        'សូមបញ្ចូលលេខដែលធំជាង ឬស្មើ 0',
    'Please enter a volume between 0 and 100':
        'សូមបញ្ចូលកម្រិតសំឡេងចន្លោះ 0 និង 100',
    'The stop point must be after the start point':
        'ចំណុចបញ្ឈប់ត្រូវនៅក្រោយចំណុចចាប់ផ្តើម',
    'Next: Interval': 'បន្ទាប់៖ រៀងរាល់ចន្លោះពេល',
    'Next: Clear Interval': 'បន្ទាប់៖ បញ្ឈប់រៀងរាល់ចន្លោះពេល',
    'Next: Timeout': 'បន្ទាប់៖ អស់ពេលកំណត់',
    Seconds: 'វិនាទី',
    'Start Auto Next': 'ចាប់ផ្តើមបន្តដោយស្វ័យប្រវត្តិ',
    'Stop Auto Next': 'បញ្ឈប់ការបន្តដោយស្វ័យប្រវត្តិ',
    'Pause Auto Next': 'ផ្អាកការបន្តដោយស្វ័យប្រវត្តិ',
    'Resume Auto Next': 'បន្តការបន្តដោយស្វ័យប្រវត្តិ',
    'Change Seconds': 'ផ្លាស់ប្តូរវិនាទី',
    'At Time': 'នៅម៉ោង',
    Timing: 'ការកំណត់ពេល',
    'Change Timing': 'ផ្លាស់ប្តូរការកំណត់ពេល',
    'Use Element Timing': 'ប្រើការកំណត់ពេលរបស់ធាតុ',
    'Please enter a valid time': 'សូមបញ្ចូលម៉ោងឲ្យបានត្រឹមត្រូវ',
    'The set time is already due': 'ម៉ោងដែលបានកំណត់ បានផុតកំណត់ហើយ',
    'Jump to': 'លោតទៅ',
    'Attach the element to jump to as a CC element':
        'សូមភ្ជាប់ធាតុដែលត្រូវលោតទៅ ជាធាតុ CC',
    'The element to jump to is not in this presenting flow':
        'ធាតុដែលត្រូវលោតទៅ មិនមាននៅក្នុងតារាងកម្មវិធីនេះទេ',
    'Keyboard Event': 'ព្រឹត្តិការណ៍ក្តារចុច',
    Shortcut: 'ផ្លូវកាត់',
    'Change Shortcut': 'ផ្លាស់ប្តូរផ្លូវកាត់',
    'Press a shortcut': 'សូមចុចផ្លូវកាត់',
    'Please press a shortcut': 'សូមចុចផ្លូវកាត់មួយ',
    'Hold Ctrl or Shift with the key': 'សូមចុច Ctrl ឬ Shift ជាមួយគ្រាប់ចុច',
    'Only Ctrl and Shift may be used': 'អាចប្រើបានតែ Ctrl និង Shift ប៉ុណ្ណោះ',
    'This key cannot be used': 'គ្រាប់ចុចនេះមិនអាចប្រើបានទេ',
    'This shortcut is already used in this presenting flow':
        'ផ្លូវកាត់នេះត្រូវបានប្រើរួចហើយនៅក្នុងតារាងកម្មវិធីនេះ',
    'Attach the elements to show as CC elements':
        'សូមភ្ជាប់ធាតុដែលត្រូវបង្ហាញ ជាធាតុ CC',
    'This element takes only one CC element':
        'ធាតុនេះទទួលបានតែធាតុ CC មួយប៉ុណ្ណោះ',
    'This element does not accept CC element': 'ធាតុនេះមិនទទួលយកធាតុ CC ទេ',
    'Open the presenting flow preview to use this action':
        'សូមបើកការមើលតារាងកម្មវិធីជាមុន ដើម្បីប្រើសកម្មភាពនេះ',
    'Please enter a number greater than 0': 'សូមបញ្ចូលលេខធំជាង 0',
    'Remove from Presenting Flow': 'ដកចេញពីតារាងកម្មវិធី',
    'Add CC Elements': 'បន្ថែមធាតុ CC',
    'Remove CC Element': 'ដកធាតុ CC ចេញ',
    'No other elements': 'គ្មានធាតុផ្សេងទៀតទេ',
    'Adding CC Element': 'កំពុងបន្ថែមធាតុ CC',
    'This item type cannot be a CC element':
        'ប្រភេទធាតុនេះមិនអាចធ្វើជាធាតុ CC បានទេ',
    'Collapse floating widget': 'បង្រួមផ្ទាំងអណ្តែត',
    'Expand floating widget': 'ពង្រីកផ្ទាំងអណ្តែត',
    'Close floating widget': 'បិទផ្ទាំងអណ្តែត',
    'Adding Presenting Flow Item': 'កំពុងបន្ថែមធាតុតារាងកម្មវិធី',
    'This item type cannot be added to a presenting flow':
        'ប្រភេទធាតុនេះមិនអាចបញ្ចូលទៅក្នុងតារាងកម្មវិធីបានទេ',
    'Showing Presenting Flow Item': 'កំពុងបង្ហាញធាតុតារាងកម្មវិធី',
    'CC element': 'ធាតុ CC',
    'Drop items here': 'ទម្លាក់ធាតុនៅទីនេះ',
    'No items in this presenting flow': 'មិនមានធាតុក្នុងតារាងកម្មវិធីនេះទេ',
    'No slides': 'មិនមានស្លាយទេ',
    'No slide selected': 'មិនបានជ្រើសរើសស្លាយទេ',
    'Add Local Files': 'បន្ថែមឯកសារក្នុងម៉ាស៊ីន',
    'Slide Thumbnail Size Scale': 'មាឌរូបភាពតូចនៃស្លាយ',
    'Collapse All': 'បង្រួមទាំងអស់',
    'Expand All': 'ពង្រីកទាំងអស់',
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
    'Are you sure to discard all change histories?':
        'តើអ្នកពិតជាចង់បោះបង់ប្រវត្តិការផ្លាស់ប្តូរទាំងអស់ឬ?',
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
    'Child Directories': 'ថតកូន',
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
    'Create OpenAI api key': 'បង្កើត OpenAI api key',
    'Creating Default Folder': 'កំពុងបង្កើតថតលំនាំដើម',
    Dark: 'ងងឹត',
    Decrement: 'បន្ថយ',
    'Define a Bible key': 'កំណត់កូនសោរព្រះគម្ពីរ',
    Delete: 'លុប',
    'Dictionary for Selected Text': 'វចនានុក្រមសម្រាប់អត្ថបទដែលបានជ្រើសរើស',
    Disable: 'បិទដំណើរការ',
    'Discard changed': 'បោះបង់ការផ្លាស់ប្តូរ',
    'Download From URL': 'ទាញយកពី URL',
    'Import From URL': 'នាំចូលពី URL',
    Download: 'ទាញយក',
    Duplicate: 'ស្ទួន',
    'Edit Parent Path': 'កែសម្រួលផ្លូវមេ',
    'Edit this web file': 'កែសម្រួលឯកសារគេហទំព័រនេះ',
    Edit: 'កែសម្រួល',
    Editor: 'កម្មវិធីកែសម្រួល',
    Empty: 'ទទេ',
    Enable: 'បើកដំណើរការ',
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
    'Hide Marquee Bottom': 'លាក់អក្សររត់ខាងក្រោម',
    'Hide Marquee Top': 'លាក់អក្សររត់ខាងលើ',
    'Hide Quick Text': 'លាក់អត្ថបទរហ័ស',
    'Hide Stopwatch': 'លាក់នាឡិកាបញ្ឈប់',
    'Hide Time': 'លាក់ម៉ោង',
    'Hide Web': 'លាក់គេហទំព័រ',
    Import: 'នាំចូល',
    Increment: 'បន្ថែម',
    'Insert Image or Video': 'បញ្ចូលរូបភាព ឬវីដេអូ',
    'Insert Image, Video or Audio': 'បញ្ចូលរូបភាព វីដេអូ ឬសំលេង',
    'Invalid Path': 'ផ្លូវមិនត្រឹមត្រូវ',
    'Key is missing': 'បាត់កូនសោរ',
    Language: 'ភាសា',
    'Learn More About Web Development':
        'ស្វែងយល់បន្ថែមអំពីការអភិវឌ្ឍន៍គេហទំព័រ',
    Light: 'ភ្លឺ',
    Lookup: 'រកមើល',
    'Markdown Music Help': 'ជំនួយតន្ត្រី Markdown',
    'Marquee Bottom': 'អក្សររត់ខាងក្រោម',
    'Marquee Top': 'អក្សររត់ខាងលើ',
    'Mix Color:': 'លាយពណ៌:',
    'Move All Items To': 'ផ្លាស់ទីធាតុទាំងអស់ទៅ',
    'Move backward': 'ផ្លាស់ទីទៅក្រោយ',
    'Move down': 'ផ្លាស់ទីចុះក្រោម',
    'Move forward': 'ផ្លាស់ទីទៅមុខ',
    'Move to Bottom': 'ផ្លាស់ទីទៅក្រោមគេ',
    'Move to Top': 'ផ្លាស់ទីទៅលើគេ',
    'Move to Trash': 'ផ្លាស់ទីទៅធុងសំរាម',
    'Move To': 'ផ្លាស់ទីទៅ',
    'Move up': 'ផ្លាស់ទីឡើងលើ',
    'More Options': 'ជម្រើសបន្ថែម',
    'New File Name': 'ឈ្មោះឯកសារថ្មី',
    'New File': 'ឯកសារថ្មី',
    'New App Document': 'ឯកសារកម្មវិធីថ្មី',
    'New Lyric': 'អក្សរភ្លេងថ្មី',
    'No App Document Selected': 'មិនមានឯកសារកម្មវិធីត្រូវបានជ្រើសរើសទេ',
    'No Bible Available': 'មិនមានព្រះគម្ពីរទេ',
    'No canvas item selected': 'មិនមានធាតុផ្ទាំងក្រណាត់ត្រូវបានជ្រើសរើសទេ',
    'No Color': 'គ្មានពណ៌',
    'No Specific Screen': 'គ្មានអេក្រង់ជាក់លាក់',
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
    Print: 'បោះពុម្ព',
    'Unable to prepare the document for printing':
        'មិនអាចរៀបចំឯកសារសម្រាប់ការបោះពុម្ពបានទេ',
    Properties: 'លក្ខណសម្បត្តិ',
    'Quick Text': 'អត្ថបទរហ័ស',
    Refresh: 'ផ្ទុកឡើងវិញ',
    Remove: 'លុបចេញ',
    'Repeat this audio': 'ធ្វើសំលេងនេះម្តងទៀត',
    'Reset All Child Directories': 'កំណត់ថតកូនទាំងអស់ឡើងវិញ',
    'Reset Rotate': 'កំណត់ការបង្វិលឡើងវិញ',
    'Reset White': 'កំណត់ពណ៌សឡើងវិញ',
    'Reset Black': 'កំណត់ពណ៌ខ្មៅឡើងវិញ',
    'Reset to default display dimension': 'កំណត់ទៅវិមាត្របង្ហាញលំនាំដើម',
    'Reset Widgets Size': 'កំណត់ទំហំ Widgets ឡើងវិញ',
    'Are you sure to reset every widget size and reopen the widgets?':
        'តើអ្នកពិតជាចង់កំណត់ទំហំ Widgets ទាំងអស់ឡើងវិញ ' +
        'ហើយបើក Widgets ដែលបានបិទឡើងវិញឬ?',
    Widgets: 'Widgets',
    'Round (%)': 'មូល (%)',
    'Round Size %:': 'ទំហំមូល %:',
    'Round Size Pixel:': 'ទំហំមូល Pixel:',
    'Round:': 'មូល:',
    'Save bible item and show on screen':
        'រក្សាទុកធាតុព្រះគម្ពីរហើយបង្ហាញនៅលើអេក្រង់',
    'Save bible item': 'រក្សាទុកធាតុព្រះគម្ពីរ',
    Save: 'រក្សាទុក',
    'Save or discard unsaved Bible changes before closing the editor.':
        'សូមរក្សាទុក ឬបោះបង់ការផ្លាស់ប្តូរព្រះគម្ពីរដែលមិនទាន់រក្សាទុក ' +
        'មុនពេលបិទកម្មវិធីកែសម្រួល។',
    'Save or discard unsaved Bible changes before refreshing.':
        'សូមរក្សាទុក ឬបោះបង់ការផ្លាស់ប្តូរព្រះគម្ពីរដែលមិនទាន់រក្សាទុក ' +
        'មុនពេលផ្ទុកឡើងវិញ។',
    'Save or discard unsaved Bible changes before switching tabs.':
        'សូមរក្សាទុក ឬបោះបង់ការផ្លាស់ប្តូរព្រះគម្ពីរដែលមិនទាន់រក្សាទុក ' +
        'មុនពេលប្តូរផ្ទាំង។',
    'Unsaved Bible Data': 'ទិន្នន័យព្រះគម្ពីរមិនទាន់រក្សាទុក',
    'Unsaved changes': 'ការផ្លាស់ប្តូរមិនទាន់រក្សាទុក',
    'Discard unsaved changes': 'បោះបង់ការផ្លាស់ប្តូរដែលមិនទាន់រក្សាទុក',
    'You have unsaved Bible changes.':
        'អ្នកមានការផ្លាស់ប្តូរព្រះគម្ពីរដែលមិនទាន់រក្សាទុក។',
    'Please save or discard them before reloading.':
        'សូមរក្សាទុក ឬបោះបង់វា មុនពេលផ្ទុកឡើងវិញ។',
    Scale: 'មាត្រដ្ឋាន',
    'Scale:': 'មាត្រដ្ឋាន:',
    'Search in Bible Search': 'ស្វែងរកក្នុងការស្វែងរកព្រះគម្ពីរ',
    'Search Selected Text on Google': 'ស្វែងរកអត្ថបទដែលបានជ្រើសរើសនៅលើ Google',
    'Select Default Folder': 'ជ្រើសរើសថតលំនាំដើម',
    'Set AI API Key': 'កំណត់ AI API Key',
    Setting: 'ការកំណត់',
    'shift + click to append': 'shift + click ដើម្បីបន្ថែមចុងក្រោយ',
    'Shift Click to Add': 'Shift Click ដើម្បីបន្ថែម',
    'Show all verses': 'បង្ហាញខគម្ពីរទាំងអស់',
    'Show bible item': 'បង្ហាញធាតុព្រះគម្ពីរ',
    'Show Editor': 'បង្ហាញកម្មវិធីកែសម្រួល',
    Show: 'បង្ហាញ',
    'Split horizontal': 'បំបែកផ្ដេក',
    'Split vertical': 'បំបែកបញ្ឈរ',
    Stage: 'ស្ទែជ',
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
    Transition: 'ការផ្លាស់ប្តូរ',
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
    'Keep Open': 'កុំបិទ',
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
    Align: 'តម្រឹម',
    'All Files': 'ឯកសារទាំងអស់',
    'AM/PM': 'ព្រឹក/ល្ងាច',
    'Apply this dimension to all slides in this document':
        'អនុវត្តវិមាត្រនេះទៅកាន់ស្លាយទាំងអស់ក្នុងឯកសារនេះ',
    'Are you sure to apply this dimension to all slides?':
        'តើអ្នកពិតជាចង់អនុវត្តវិមាត្រនេះទៅកាន់ស្លាយទាំងអស់ឬ?',
    Auto: 'ស្វ័យប្រវត្តិ',
    'Backdrop Filter': 'តម្រងផ្ទៃខាងក្រោយ',
    'Camera Error': 'កំហុសកាមេរ៉ា',
    City: 'ទីក្រុង',
    Collapse: 'បង្រួម',
    'Corner radius in pixels (0 to use %)':
        'កាំជ្រុងគិតជាភីកសែល (0 ដើម្បីប្រើ %)',
    'Count down for a duration': 'រាប់ថយក្រោយតាមរយៈពេល',
    'Count down to a specific date & time':
        'រាប់ថយក្រោយទៅកាន់ថ្ងៃ និងម៉ោងជាក់លាក់',
    'Count up from zero': 'រាប់ឡើងចាប់ពីសូន្យ',
    Delay: 'ការពន្យារពេល',
    'Double click on header to edit': 'ចុចពីរដងលើក្បាលដើម្បីកែសម្រួល',
    Expand: 'ពង្រីក',
    Export: 'នាំចេញ',
    'Export Data': 'នាំចេញទិន្នន័យ',
    'Import Data': 'នាំចូលទិន្នន័យ',
    'Choose the folders to export': 'ជ្រើសរើសថតដែលត្រូវនាំចេញ',
    'Choose the folders to import': 'ជ្រើសរើសថតដែលត្រូវនាំចូល',
    // Every export and import now opens a dialog, and the popup renders its
    // title through `tran` — so each flow's title needs an entry of its own.
    'Export Document': 'នាំចេញឯកសារ',
    'Import Document': 'នាំចូលឯកសារ',
    'Export Bible List': 'នាំចេញបញ្ជីព្រះគម្ពីរ',
    'Import Bible List': 'នាំចូលបញ្ជីព្រះគម្ពីរ',
    'Export Presenting Flow': 'នាំចេញតារាងកម្មវិធី',
    'Import Presenting Flow': 'នាំចូលតារាងកម្មវិធី',
    'Export Bible Note Item': 'នាំចេញកំណត់ចំណាំព្រះគម្ពីរ',
    'Import Bible Note Item': 'នាំចូលកំណត់ចំណាំព្រះគម្ពីរ',
    // The two bodies every export/import toast is built from. The path or the
    // name goes on AFTER the translation, never into the key.
    'Exported to': 'បាននាំចេញទៅ',
    Imported: 'បាននាំចូល',
    // The optional password protection on every export.
    Password: 'ពាក្យសម្ងាត់',
    'Confirm Password': 'បញ្ជាក់ពាក្យសម្ងាត់',
    'Show Password': 'បង្ហាញពាក្យសម្ងាត់',
    'Hide Password': 'លាក់ពាក្យសម្ងាត់',
    'Leave empty to export without a password':
        'ទុកឲ្យទទេ ដើម្បីនាំចេញដោយគ្មានពាក្យសម្ងាត់',
    'Passwords do not match': 'ពាក្យសម្ងាត់មិនត្រូវគ្នាទេ',
    'This archive is password protected':
        'ឯកសារបណ្ណសារនេះត្រូវបានការពារដោយពាក្យសម្ងាត់',
    'Wrong password, try again': 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវ សូមព្យាយាមម្តងទៀត',
    'Select All': 'ជ្រើសរើសទាំងអស់',
    'Deselect All': 'ដកការជ្រើសរើសទាំងអស់',
    'Nothing is selected': 'មិនបានជ្រើសរើសអ្វីទេ',
    'Fail to get data for': 'បរាជ័យក្នុងការទទួលបានទិន្នន័យសម្រាប់',
    'Font size in pixels': 'ទំហំតួអក្សរគិតជាភីកសែល',
    'Glass Effect': 'បែបផែនកញ្ចក់',
    "Insert today's date as the marquee bottom text":
        'បញ្ចូលកាលបរិច្ឆេទថ្ងៃនេះជាអត្ថបទអក្សររត់ខាងក្រោម',
    "Insert today's date as the marquee top text":
        'បញ្ចូលកាលបរិច្ឆេទថ្ងៃនេះជាអត្ថបទអក្សររត់ខាងលើ',
    'Label shown above the time': 'ស្លាកបង្ហាញនៅពីលើម៉ោង',
    Live: 'ផ្សាយផ្ទាល់',
    Markdown: 'Markdown',
    'Marquee Bottom font size (0 = auto)':
        'ទំហំតួអក្សរអក្សររត់ខាងក្រោម (0 = ស្វ័យប្រវត្តិ)',
    'Marquee Bottom scroll speed (%)': 'ល្បឿនរំកិលអក្សររត់ខាងក្រោម (%)',
    'Marquee Top font size (0 = auto)':
        'ទំហំតួអក្សរអក្សររត់ខាងលើ (0 = ស្វ័យប្រវត្តិ)',
    'Marquee Top scroll speed (%)': 'ល្បឿនរំកិលអក្សររត់ខាងលើ (%)',
    Missing: 'បាត់',
    Name: 'ឈ្មោះ',
    'No languages available.': 'មិនមានភាសាទេ។',
    'No pages to display': 'មិនមានទំព័រដើម្បីបង្ហាញទេ',
    Normal: 'ធម្មតា',
    Opacity: 'ភាពស្រអាប់',
    'Pick a city to set its timezone':
        'ជ្រើសរើសទីក្រុងដើម្បីកំណត់តំបន់ពេលវេលារបស់វា',
    'Please install the missing fonts from the opened pages. and restart the app after installation.':
        'សូមដំឡើងពុម្ពអក្សរដែលបាត់ពីទំព័រដែលបានបើក ' +
        'ហើយចាប់ផ្តើមកម្មវិធីឡើងវិញបន្ទាប់ពីការដំឡើង។',
    'Position offset in pixels': 'ការផ្លាស់ទីទីតាំងគិតជាភីកសែល',
    'Preview BG:': 'មើលផ្ទៃខាងក្រោយ:',
    'Quick font size': 'ទំហំតួអក្សររហ័ស',
    'Quick scroll speed': 'ល្បឿនរំកិលរហ័ស',
    'Return to Presenter': 'ត្រឡប់ទៅកម្មវិធីបង្ហាញ',
    'Open Worship slide required': 'ត្រូវការស្លាយ Open Worship',
    'The selected document is not an Open Worship slide. Return to Presenter?':
        'ឯកសារដែលបានជ្រើសរើសមិនមែនជាស្លាយ Open Worship ទេ។ ត្រឡប់ទៅកម្មវិធីបង្ហាញ?',
    'Seconds the text stays on screen': 'ចំនួនវិនាទីដែលអត្ថបទនៅលើអេក្រង់',
    'Seconds to wait before showing the text':
        'ចំនួនវិនាទីត្រូវរង់ចាំមុនពេលបង្ហាញអត្ថបទ',
    Size: 'ទំហំ',
    'Slide Id': 'លេខសម្គាល់ស្លាយ',
    'Slide index': 'លំដាប់ស្លាយ',
    'This key will be used in custom Bible Cross Ref':
        'កូនសោរនេះនឹងត្រូវបានប្រើក្នុងឯកសារយោងឆ្លងព្រះគម្ពីរផ្ទាល់ខ្លួន',
    'This key will be used in custom Bible Cross Ref and Bible Audio':
        'កូនសោរនេះនឹងត្រូវបានប្រើក្នុងឯកសារយោងឆ្លងព្រះគម្ពីរផ្ទាល់ខ្លួន ' +
        'និងសំលេងព្រះគម្ពីរ',
    "Today's Date": 'កាលបរិច្ឆេទថ្ងៃនេះ',
    'Unable to access the camera for background. Please check your camera settings.':
        'មិនអាចចូលប្រើកាមេរ៉ាសម្រាប់ផ្ទៃខាងក្រោយបានទេ។ ' +
        'សូមពិនិត្យការកំណត់កាមេរ៉ារបស់អ្នក។',
    'Use Current Timezone': 'ប្រើតំបន់ពេលវេលាបច្ចុប្បន្ន',
    'Use this device’s timezone': 'ប្រើតំបន់ពេលវេលានៃឧបករណ៍នេះ',
    'UTC Offset': 'ការបន្ថែម/បញ្ចូល UTC',
    'You will be redirected to the General Settings page to select a parent directory.':
        'អ្នកនឹងត្រូវបានបញ្ជូនទៅទំព័រការកំណត់ទូទៅ ដើម្បីជ្រើសរើសថតមេ។',
    'Start Controlling': 'ចាប់ផ្តើមគ្រប់គ្រង',
    'Presenting Control': 'ការគ្រប់គ្រងការបង្ហាញ',
    'Presenting tool': 'ឧបករណ៍បង្ហាញ',
    Color: 'ពណ៌',
    'Stroke style': 'រចនាប័ទ្មខ្សែ',
    Straight: 'ត្រង់',
    '3D': '3D',
    Dots: 'ចំណុច',
    HQ: 'គុណភាពខ្ពស់',
    Fast: 'លឿន',
    Hold: 'សង្កត់',
    Follow: 'តាមដាន',
    Contrast: 'បញ្ច្រាស',
    'High quality drawing (anti-aliased, slower)':
        'គំនូរគុណភាពខ្ពស់ (រលោង តែយឺតជាង)',
    'Fast drawing (lighter, less smooth)': 'គំនូរលឿន (ស្រាលជាង តែមិនសូវរលោង)',
    'Toggle drawing quality': 'ប្តូរគុណភាពគំនូរ',
    'Reset settings': 'កំណត់ការកំណត់ឡើងវិញ',
    'Drag over the drawing to rub it out': 'អូសលើគំនូរដើម្បីលុបវាចេញ',
    'Drag anywhere on the app to draw':
        'អូសនៅកន្លែងណាក៏បាននៅលើកម្មវិធីដើម្បីគូរ',
    'Spotlight size': 'ទំហំពន្លឺបញ្ចាំង',
    'Dim color': 'ពណ៌ស្រអាប់',
    'Dim the rest of the app': 'ធ្វើឱ្យផ្នែកដទៃនៃកម្មវិធីស្រអាប់',
    'Spotlight edge blur (0 = hard edge)':
        'ភាពព្រិលគែមពន្លឺបញ្ចាំង (0 = គែមច្បាស់)',
    'Contrast: the circle blocks what the pointer is over':
        'បញ្ច្រាស៖ រង្វង់បាំងអ្វីដែលទ្រនិចកំពុងចង្អុល',
    'Spotlight: the circle reveals what the pointer is over':
        'ពន្លឺបញ្ចាំង៖ រង្វង់បង្ហាញអ្វីដែលទ្រនិចកំពុងចង្អុល',
    'Hold: dim only while the button is down':
        'សង្កត់៖ ធ្វើឱ្យស្រអាប់តែពេលសង្កត់ប៊ូតុងប៉ុណ្ណោះ',
    'Follow: the spotlight tracks the pointer': 'តាមដាន៖ ពន្លឺបញ្ចាំងតាមទ្រនិច',
    'Hold to spotlight': 'សង្កត់ដើម្បីបញ្ចាំងពន្លឺ',
    'Press and hold on the app to spotlight':
        'ចុចសង្កត់លើកម្មវិធីដើម្បីបញ្ចាំងពន្លឺ',
    'Move over the app to spotlight': 'ផ្លាស់ទីលើកម្មវិធីដើម្បីបញ្ចាំងពន្លឺ',
    'Use the app (drawing stays on top)': 'ប្រើកម្មវិធី (គំនូរនៅតែលើគេ)',
    'Draw on the app': 'គូរលើកម្មវិធី',
    'Erase parts of the drawing': 'លុបផ្នែកខ្លះនៃគំនូរ',
    'Spotlight part of the app': 'បញ្ចាំងពន្លឺលើផ្នែកខ្លះនៃកម្មវិធី',
    'Keyboard screencast': 'ការបង្ហាញគ្រាប់ចុច',
    'Available while using the app': 'អាចប្រើបាននៅពេលកំពុងប្រើកម្មវិធី',
    'Show the keys being pressed': 'បង្ហាញគ្រាប់ចុចដែលកំពុងចុច',
    'Drawing history': 'ប្រវត្តិគំនូរ',
    'Clear drawing': 'លុបគំនូរ',
    'Paste Bible Item': 'បិទភ្ជាប់ធាតុព្រះគម្ពីរ',
    Unlock: 'ដោះសោ',
    Lock: 'ចាក់សោ',
    Left: 'ឆ្វេង',
    Top: 'លើ',
    Width: 'ទទឹង',
    Height: 'កម្ពស់',
    'Horizontal alignment': 'ការតម្រឹមផ្ដេក',
    'Text align left': 'តម្រឹមអក្សរឆ្វេង',
    'Text align center': 'តម្រឹមអក្សរកណ្តាល',
    'Text align right': 'តម្រឹមអក្សរស្តាំ',
    'Align left': 'តម្រឹមឆ្វេង',
    'Align center': 'តម្រឹមកណ្តាល',
    'Align right': 'តម្រឹមស្តាំ',
    'Vertical alignment': 'ការតម្រឹមបញ្ឈរ',
    'Align top': 'តម្រឹមខាងលើ',
    'Align middle': 'តម្រឹមកណ្តាលបញ្ឈរ',
    'Align bottom': 'តម្រឹមខាងក្រោម',
    'Box Layer': 'ស្រទាប់ប្រអប់',
    'Send backward': 'បញ្ជូនទៅក្រោយ',
    'Bring forward': 'នាំមកមុខ',
    Saved: 'បានរក្សាទុក',
    'Saved current text': 'បានរក្សាទុកអត្ថបទបច្ចុប្បន្ន',
    'Delete this saved session': 'លុបវគ្គដែលបានរក្សាទុកនេះ',
    'Save the current text as a session': 'រក្សាទុកអត្ថបទបច្ចុប្បន្នជាវគ្គមួយ',
    'Pick a previously saved session': 'ជ្រើសរើសវគ្គដែលបានរក្សាទុកពីមុន',
    'Nothing to save: the text is empty': 'គ្មានអ្វីត្រូវរក្សាទុកទេ៖ អត្ថបទទទេ',
    'This text is already the latest saved session':
        'អត្ថបទនេះជាវគ្គដែលបានរក្សាទុកចុងក្រោយរួចហើយ',
    'Replace the current text with this saved session? Your current unsaved text will be lost.':
        'ជំនួសអត្ថបទបច្ចុប្បន្នដោយវគ្គដែលបានរក្សាទុកនេះឬ? ' +
        'អត្ថបទបច្ចុប្បន្នដែលមិនទាន់រក្សាទុកនឹងបាត់បង់។',
    'Manual eraser': 'ជ័រលុបដោយដៃ',
    'Manual eraser: drag over the drawing to rub out parts of it, or back to painting':
        'ជ័រលុបដោយដៃ៖ អូសលើគំនូរដើម្បីលុបផ្នែកខ្លះចេញ ឬត្រឡប់ទៅគូរវិញ',
    'Dim the rest of the screen': 'ធ្វើឱ្យផ្នែកដទៃនៃអេក្រង់ស្រអាប់',
    'Release to stop': 'លែងដៃដើម្បីបញ្ឈប់',
    'Press and hold on the screen to spotlight':
        'ចុចសង្កត់លើអេក្រង់ដើម្បីបញ្ចាំងពន្លឺ',
    'Choose Drawing or Focusing': 'ជ្រើសរើសការគូរ ឬការផ្តោត',
    Drawing: 'ការគូរ',
    Focusing: 'ការផ្តោត',
    'Missing fonts': 'ពុម្ពអក្សរដែលបាត់',
    'these fonts are not installed on your system, slides may not render as intended. Click a font to search for it:':
        'ពុម្ពអក្សរទាំងនេះមិនបានដំឡើងនៅលើប្រព័ន្ធរបស់អ្នកទេ ' +
        'ស្លាយអាចនឹងបង្ហាញមិនដូចបំណង។ ចុចលើពុម្ពអក្សរដើម្បីស្វែងរកវា៖',
    'Search for font': 'ស្វែងរកពុម្ពអក្សរ',
    'Full view': 'ទិដ្ឋភាពពេញ',
    'Exit full view': 'ចាកចេញពីទិដ្ឋភាពពេញ',
    'Pin document': 'ខ្ទាស់ឯកសារ',
    'Unpin document': 'ដោះខ្ទាស់ឯកសារ',
    'Document is pinned': 'ឯកសារត្រូវបានខ្ទាស់',
    'Unpin the document to preview another one':
        'សូមដោះខ្ទាស់ឯកសារដើម្បីមើលឯកសារផ្សេងទៀត',
    'Media playing': 'កំពុងលេងមេឌា',
    'Media is Playing': 'មេឌាកំពុងលេង',
    'Please pause all audio and video before leaving the page.':
        'សូមផ្អាកសំលេង និងវីដេអូទាំងអស់មុនពេលចាកចេញពីទំព័រ។',
    Undo: 'ត្រឡប់ក្រោយ',
    Redo: 'ធ្វើឡើងវិញ',
    Help: 'ជំនួយ',
    'Bible Properties': 'លក្ខណសម្បត្តិព្រះគម្ពីរ',
    'Thumbnail View': 'ទិដ្ឋភាពរូបតូច',
    'List View': 'ទិដ្ឋភាពបញ្ជី',
    // --- Untranslated UI strings routed through tran() (audit 2026-08-08).
    // Machine-authored Khmer following the dictionary's existing conventions;
    // a native speaker should review the phrasing.
    '(Under development, please use XML instead)':
        '(កំពុងអភិវឌ្ឍន៍ សូមប្រើ XML ជំនួសវិញ)',
    'Adding bible': 'កំពុងបន្ថែមព្រះគម្ពីរ',
    'Adding Bible Item': 'កំពុងបន្ថែមធាតុព្រះគម្ពីរ',
    'Adding Presenting Flow Action': 'កំពុងបន្ថែមសកម្មភាពតារាងកម្មវិធី',
    'Already in XML': 'មានក្នុង XML រួចហើយ',
    'Background Color': 'ពណ៌ផ្ទៃខាងក្រោយ',
    'Hit "Escape" to jump back to editing input':
        'ចុច "Escape" ដើម្បីត្រឡប់ទៅប្រអប់កែសម្រួលវិញ',
    'Bible Cross Reference': 'ឯកសារយោងព្រះគម្ពីរ',
    'Bible Download': 'ការទាញយកព្រះគម្ពីរ',
    'Bible extracted': 'បានស្រង់ព្រះគម្ពីរ',
    'Bible Item': 'ធាតុព្រះគម្ពីរ',
    'Bible item is added': 'ធាតុព្រះគម្ពីរត្រូវបានបន្ថែម',
    'Bible item is inserted into the editing slide':
        'ធាតុព្រះគម្ពីរត្រូវបានបញ្ចូលទៅក្នុងស្លាយកែសម្រួល',
    'Bible Text to Speech': 'ព្រះគម្ពីរបំលែងអក្សរទៅជាសំលេង',
    'Book Chapter': 'ជំពូកគម្ពីរ',
    'Books map': 'ផែនទីគម្ពីរ',
    'Box Alignment': 'ការតម្រឹមប្រអប់',
    'Box Properties': 'លក្ខណសម្បត្តិប្រអប់',
    'Cannot find Bible Item': 'រកមិនឃើញធាតុព្រះគម្ពីរ',
    'Cannot find Note Item': 'រកមិនឃើញធាតុកំណត់សម្គាល់',
    'Cannot source Bible': 'មិនអាចទាញយកប្រភពព្រះគម្ពីរបានទេ',
    'Cannot source Note': 'មិនអាចទាញយកប្រភពកំណត់សម្គាល់បានទេ',
    'Canvas item not found': 'រកមិនឃើញធាតុផ្ទាំងក្រណាត់',
    'Canvas Scale': 'មាត្រដ្ឋានផ្ទាំងក្រណាត់',
    'Chapter data not found.': 'រកមិនឃើញទិន្នន័យជំពូក។',
    'Choose Bible Books': 'ជ្រើសរើសគម្ពីរ',
    'Choose Locale': 'ជ្រើសរើសភាសា',
    'Clear url': 'សម្អាត URL',
    'Click to edit this section': 'ចុចដើម្បីកែសម្រួលផ្នែកនេះ',
    'Color Note': 'ចំណាំពណ៌',
    'Converting to PDF': 'កំពុងបំលែងទៅជា PDF',
    'Copy Color': 'ចម្លងពណ៌',
    'Copy Error Json': 'ចម្លង Json កំហុស',
    'Create New Web File': 'បង្កើតឯកសារវេបថ្មី',
    'Creating Presenting Flow': 'កំពុងបង្កើតតារាងកម្មវិធី',
    'Delete Bible': 'លុបព្រះគម្ពីរ',
    'Delete Bible XML': 'លុប XML ព្រះគម្ពីរ',
    'Delete Canvas Items': 'លុបធាតុផ្ទាំងក្រណាត់',
    Deleting: 'កំពុងលុប',
    'Document downloaded successfully': 'បានទាញយកឯកសារដោយជោគជ័យ',
    'Document Note': 'កំណត់សម្គាល់ឯកសារ',
    'Download Error': 'កំហុសក្នុងការទាញយក',
    'Downloaded Bible List': 'បញ្ជីព្រះគម្ពីរដែលបានទាញយក',
    'Drag onto the canvas to add a guide line':
        'អូសទៅលើផ្ទាំងក្រណាត់ដើម្បីបន្ថែមបន្ទាត់ណែនាំ',
    'Drag to move, double-click to remove':
        'អូសដើម្បីផ្លាស់ទី ចុចពីរដងដើម្បីលុប',
    'Drag to resize': 'អូសដើម្បីប្តូរទំហំ',
    'Duplicating File': 'កំពុងចម្លងឯកសារ',
    'Edit Books Map': 'កែសម្រួលផែនទីគម្ពីរ',
    'Edit Canvas Item': 'កែសម្រួលធាតុផ្ទាំងក្រណាត់',
    'Edit Numbers Map': 'កែសម្រួលផែនទីលេខ',
    'Error occurred during downloading audio': 'មានបញ្ហាពេលកំពុងទាញយកសំលេង',
    'Error occurred during downloading document': 'មានបញ្ហាពេលកំពុងទាញយកឯកសារ',
    'Error occurred during downloading image': 'មានបញ្ហាពេលកំពុងទាញយករូបភាព',
    'Error occurred during downloading video': 'មានបញ្ហាពេលកំពុងទាញយកវីដេអូ',
    'Error occurred during finishing bible download':
        'មានបញ្ហាពេលកំពុងបញ្ចប់ការទាញយកព្រះគម្ពីរ',
    'Error occurred during generating file name':
        'មានបញ្ហាពេលកំពុងបង្កើតឈ្មោះឯកសារ',
    'Error occurred during pasting image': 'មានបញ្ហាពេលកំពុងបិទភ្ជាប់រូបភាព',
    'Error occurred during reading file': 'មានបញ្ហាពេលកំពុងអានឯកសារ',
    'Error occurred during saving to XML': 'មានបញ្ហាពេលកំពុងរក្សាទុកទៅ XML',
    Extra: 'បន្ថែម',
    'Extracting Bible': 'កំពុងស្រង់ព្រះគម្ពីរ',
    'Fail to add bible item': 'បរាជ័យក្នុងការបន្ថែមធាតុព្រះគម្ពីរ',
    'Fail to add bible to list': 'បរាជ័យក្នុងការបន្ថែមព្រះគម្ពីរទៅបញ្ជី',
    'Fail to delete downloaded file': 'បរាជ័យក្នុងការលុបឯកសារដែលបានទាញយក',
    'Fail to ensure data directory for AI data.':
        'បរាជ័យក្នុងការធានាថតទិន្នន័យសម្រាប់ទិន្នន័យ AI។',
    'Fail to extract bible': 'បរាជ័យក្នុងការស្រង់ព្រះគម្ពីរ',
    'Fail to fetch bible online': 'បរាជ័យក្នុងការទាញយកព្រះគម្ពីរតាមអនឡាញ',
    'Fail to get Anthropic instance':
        'បរាជ័យក្នុងការទទួលបាន Anthropic instance',
    'Fail to get bible item data':
        'បរាជ័យក្នុងការទទួលបានទិន្នន័យធាតុព្រះគម្ពីរ',
    'Fail to get bible list': 'បរាជ័យក្នុងការទទួលបានបញ្ជីព្រះគម្ពីរ',
    'Fail to get default bible file':
        'បរាជ័យក្នុងការទទួលបានឯកសារព្រះគម្ពីរលំនាំដើម',
    'Fail to get default note file':
        'បរាជ័យក្នុងការទទួលបានឯកសារកំណត់សម្គាល់លំនាំដើម',
    'Fail to get OpenAI instance': 'បរាជ័យក្នុងការទទួលបាន OpenAI instance',
    'Fail to insert image': 'បរាជ័យក្នុងការបញ្ចូលរូបភាព',
    'Fail to insert media link': 'បរាជ័យក្នុងការបញ្ចូលតំណមេឌៀ',
    'Fail to insert medias': 'បរាជ័យក្នុងការបញ្ចូលមេឌៀ',
    'Fail to insert website': 'បរាជ័យក្នុងការបញ្ចូលវេបសាយ',
    'Fail to insert camera': 'បរាជ័យក្នុងការបញ្ចូលកាមេរ៉ា',
    'Fail to insert YouTube': 'បរាជ័យក្នុងការបញ្ចូល YouTube',
    'Failed to convert KJV Bible data to XML text.':
        'បរាជ័យក្នុងការបំលែងទិន្នន័យព្រះគម្ពីរ KJV ទៅជាអក្សរ XML។',
    'Failed to parse XML data': 'បរាជ័យក្នុងការញែកទិន្នន័យ XML',
    'Failed to save image': 'បរាជ័យក្នុងការរក្សាទុករូបភាព',
    'Fetching Bible Finding Online':
        'កំពុងទាញយកលទ្ធផលស្វែងរកព្រះគម្ពីរតាមអនឡាញ',
    'File already exists': 'ឯកសារមានរួចហើយ',
    'file name': 'ឈ្មោះឯកសារ',
    'Close find': 'បិទការស្វែងរក',
    'Drag to move the find panel': 'អូសដើម្បីផ្លាស់ទីផ្ទាំងស្វែងរក',
    'Match case': 'ប្រកាន់អក្សរតូចធំ',
    'Match count': 'ចំនួនលទ្ធផល',
    'Next match': 'លទ្ធផលបន្ទាប់',
    'Previous match': 'លទ្ធផលមុន',
    'Fit to canvas': 'ធ្វើឲ្យសមនឹងផ្ទាំងក្រណាត់',
    Font: 'ពុម្ពអក្សរ',
    'Fork me on GitHub': 'Fork ខ្ញុំនៅលើ GitHub',
    'Format Submit Error': 'កំហុសក្នុងការដាក់ស្នើទ្រង់ទ្រាយ',
    'Getting Bible Info': 'កំពុងទទួលបានព័ត៌មានព្រះគម្ពីរ',
    'Getting bible list': 'កំពុងទទួលបានបញ្ជីព្រះគម្ពីរ',
    'Getting Default Bible File': 'កំពុងទទួលបានឯកសារព្រះគម្ពីរលំនាំដើម',
    'Getting Default Note File': 'កំពុងទទួលបានឯកសារកំណត់សម្គាល់លំនាំដើម',
    'Guessing keys:': 'កំពុងស្មានកូនសោ៖',
    'Guessing Names': 'កំពុងស្មានឈ្មោះ',
    Hours: 'ម៉ោង',
    Info: 'ព័ត៌មាន',
    'Instantiating Bible Item': 'កំពុងបង្កើតធាតុព្រះគម្ពីរ',
    'Instantiating Note Item': 'កំពុងបង្កើតធាតុកំណត់សម្គាល់',
    'Instantiating Presenting Flow Item': 'កំពុងបង្កើតធាតុតារាងកម្មវិធី',
    'Instantiating Slide': 'កំពុងបង្កើតស្លាយ',
    'Invalid file name': 'ឈ្មោះឯកសារមិនត្រឹមត្រូវ',
    'Invalid URL': 'URL មិនត្រឹមត្រូវ',
    'Item ID:': 'លេខសម្គាល់ធាតុ៖',
    'Jumping Chapter': 'កំពុងលោតទៅជំពូក',
    'Leave a markdown text here': 'សរសេរអក្សរ markdown នៅទីនេះ',
    'LibreOffice is not installed': 'មិនបានដំឡើង LibreOffice',
    Locked: 'បានចាក់សោ',
    'Locked items cannot be deleted': 'ធាតុដែលបានចាក់សោមិនអាចលុបបានទេ',
    Minutes: 'នាទី',
    'Missing Anthropic API Key.': 'បាត់ Anthropic API Key។',
    'Missing OpenAI API Key.': 'បាត់ OpenAI API Key។',
    'Move Bible Item': 'ផ្លាស់ទីធាតុព្រះគម្ពីរ',
    'Move Note Item': 'ផ្លាស់ទីធាតុកំណត់សម្គាល់',
    'Moving Bible Item': 'កំពុងផ្លាស់ទីធាតុព្រះគម្ពីរ',
    'Moving Note Item': 'កំពុងផ្លាស់ទីធាតុកំណត់សម្គាល់',
    Next: 'បន្ទាប់',
    'No bible downloaded': 'មិនមានព្រះគម្ពីរដែលបានទាញយក',
    'No Data': 'គ្មានទិន្នន័យ',
    'No data to process': 'គ្មានទិន្នន័យសម្រាប់ដំណើរការ',
    'No other bibles found': 'រកមិនឃើញព្រះគម្ពីរផ្សេងទៀត',
    'No other notes found': 'រកមិនឃើញកំណត់សម្គាល់ផ្សេងទៀត',
    'No other slide found in the slide directory':
        'រកមិនឃើញស្លាយផ្សេងទៀតក្នុងថតស្លាយ',
    'No Slide Available': 'គ្មានស្លាយ',
    'Online Bible List': 'បញ្ជីព្រះគម្ពីរអនឡាញ',
    'Only image, video and audio files are supported':
        'គាំទ្រតែឯកសាររូបភាព វីដេអូ និងសំលេងប៉ុណ្ណោះ',
    'Only image, video and audio links are supported':
        'គាំទ្រតែតំណរូបភាព វីដេអូ និងសំលេងប៉ុណ្ណោះ',
    'Open Folder': 'បើកថត',
    'Open Note Item Context Menu': 'បើកម៉ឺនុយបរិបទធាតុកំណត់សម្គាល់',
    'Open Wiki Dictionary': 'បើកវចនានុក្រម Wiki',
    'Parsing XML': 'កំពុងញែក XML',
    'Pasting Image': 'កំពុងបិទភ្ជាប់រូបភាព',
    'PDF Document': 'ឯកសារ PDF',
    'Play to bottom': 'ចាក់ទៅបាត',
    'Please open a folder first': 'សូមបើកថតជាមុនសិន',
    'Please select an Open Worship slide first':
        'សូមជ្រើសរើសស្លាយ Open Worship ជាមុនសិន',
    'Position & Size': 'ទីតាំង និងទំហំ',
    'PowerPoint Document': 'ឯកសារ PowerPoint',
    'Preview Size Scale': 'មាត្រដ្ឋានទំហំមើលជាមុន',
    Previous: 'មុន',
    'Reset Date and Time to Now': 'កំណត់កាលបរិច្ឆេទ និងម៉ោងទៅពេលឥឡូវនេះ',
    'Rotate:': 'បង្វិល៖',
    'Saving Bible Data': 'កំពុងរក្សាទុកទិន្នន័យព្រះគម្ពីរ',
    'Saving File': 'កំពុងរក្សាទុកឯកសារ',
    'Scroll to the top': 'រំកិលទៅលើគេ',
    'Seek Item': 'ស្វែងរកធាតុ',
    'Select custom color': 'ជ្រើសរើសពណ៌ផ្ទាល់ខ្លួន',
    'Set according paths': 'កំណត់ផ្លូវទៅតាមនោះ',
    'Set round size pixel to 0 to use this':
        'កំណត់ទំហំមូលភីកសែលទៅ 0 ដើម្បីប្រើវា',
    'Set to original size': 'កំណត់ទៅទំហំដើម',
    'Shape Properties': 'លក្ខណសម្បត្តិរូបរាង',
    'Slide Note': 'កំណត់សម្គាល់ស្លាយ',
    'Target bible not found': 'រកមិនឃើញព្រះគម្ពីរគោលដៅ',
    'Target note not found': 'រកមិនឃើញកំណត់សម្គាល់គោលដៅ',
    'Text Alignment': 'ការតម្រឹមអក្សរ',
    'Text has been copied to clip': 'អក្សរត្រូវបានចម្លងទៅក្ដារតម្បៀតខ្ទាស់',
    'Text Properties': 'លក្ខណសម្បត្តិអក្សរ',
    'Text to Speech': 'បំលែងអក្សរទៅជាសំលេង',
    'This bible is already in XML': 'ព្រះគម្ពីរនេះមានក្នុង XML រួចហើយ',
    'This item is locked': 'ធាតុនេះត្រូវបានចាក់សោ',
    'Thumbnail Size': 'ទំហំរូបតូច',
    title: 'ចំណងជើង',
    'Toggle Always On Top': 'បិទ/បើកនៅលើគេជានិច្ច',
    'Toggle full screen failed': 'ការបិទ/បើកអេក្រង់ពេញបរាជ័យ',
    'Type the slide text here': 'វាយអក្សរស្លាយនៅទីនេះ',
    'Unable to duplicate file': 'មិនអាចចម្លងឯកសារបានទេ',
    'Unable to export BibleNote item': 'មិនអាចនាំចេញធាតុ BibleNote បានទេ',
    'Unable to find the target bible item': 'រកមិនឃើញធាតុព្រះគម្ពីរគោលដៅ',
    'Unable to get bible': 'មិនអាចទទួលបានព្រះគម្ពីរបានទេ',
    'Unable to get bible info list': 'មិនអាចទទួលបានបញ្ជីព័ត៌មានព្រះគម្ពីរបានទេ',
    'Unable to get downloaded bible list':
        'មិនអាចទទួលបានបញ្ជីព្រះគម្ពីរដែលបានទាញយកបានទេ',
    'Unable to get note': 'មិនអាចទទួលបានកំណត់សម្គាល់បានទេ',
    'Unable to import BibleNote item': 'មិនអាចនាំចូលធាតុ BibleNote បានទេ',
    'Unable to read file': 'មិនអាចអានឯកសារបានទេ',
    'Unable to seek bible item': 'មិនអាចស្វែងរកធាតុព្រះគម្ពីរបានទេ',
    'Unfixable Error': 'កំហុសមិនអាចជួសជុលបាន',
    'Unsupported image data': 'ទិន្នន័យរូបភាពមិនត្រូវបានគាំទ្រ',
    Update: 'ធ្វើបច្ចុប្បន្នភាព',
    'URL already exists': 'URL មានរួចហើយ',
    'Wiki Dictionary': 'វចនានុក្រម Wiki',
    'Word Document': 'ឯកសារ Word',
    // --- Names & locations lookup panel (`src/location-name-lookup`).
    // Machine-authored Khmer following the dictionary's existing conventions;
    // a native speaker should review the phrasing. Note `All Types` above
    // already covers the panel's "All types" option after key sanitization.
    'Names and locations lookup': 'ការស្វែងរកឈ្មោះ និងទីកន្លែង',
    Names: 'ឈ្មោះ',
    Locations: 'ទីកន្លែង',
    'Search names': 'ស្វែងរកឈ្មោះ',
    'Search locations': 'ស្វែងរកទីកន្លែង',
    'Clear search': 'សម្អាតការស្វែងរក',
    'Filter by name type': 'ត្រងតាមប្រភេទឈ្មោះ',
    'Type filter applies to names only':
        'ការត្រងប្រភេទអនុវត្តចំពោះឈ្មោះតែប៉ុណ្ណោះ',
    'No matches': 'រកមិនឃើញ',
    'Jump to page': 'ទៅកាន់ទំព័រ',
    'Type a page number and press Enter': 'វាយលេខទំព័រ រួចចុច Enter',
    'Loading lookup data': 'កំពុងផ្ទុកទិន្នន័យស្វែងរក',
    'Failed to load lookup data': 'មិនអាចផ្ទុកទិន្នន័យស្វែងរកបានទេ',
    // The bible lookup side-panel tab listing what is in the verses on screen.
    'Location-Name (KJV)': 'ទីកន្លែង-ឈ្មោះ (KJV)',
    'Names and locations in your reading':
        'ឈ្មោះ និងទីកន្លែងក្នុងខគម្ពីរដែលអ្នកកំពុងអាន',
    // Name-type filter options.
    Concepts: 'គំនិត',
    Deities: 'ព្រះ',
    Groups: 'ក្រុម',
    Life: 'ជីវិត',
    Months: 'ខែ',
    People: 'មនុស្ស',
    Places: 'ទីកន្លែង',
    Supernatural: 'អធិធម្មជាតិ',
    Unknown: 'មិនស្គាល់',
    // Record detail panel. `Title`, `Type`, `Copy` and `Copied` already exist
    // above and resolve after key sanitization, so they are not repeated here —
    // a duplicate would throw when this module loads.
    'Record not found': 'រកមិនឃើញកំណត់ត្រា',
    Details: 'ព័ត៌មានលម្អិត',
    'Also called': 'ហៅផងដែរថា',
    Gender: 'ភេទ',
    Age: 'អាយុ',
    Years: 'ឆ្នាំ',
    Parents: 'ឪពុកម្ដាយ',
    Spouses: 'ប្ដីប្រពន្ធ',
    Children: 'កូន',
    Siblings: 'បងប្អូន',
    Cousins: 'បងប្អូនជីដូនមួយ',
    Verses: 'ខគម្ពីរ',
    Links: 'តំណភ្ជាប់',
    'Modern identification': 'ការកំណត់អត្តសញ្ញាណសម័យទំនើប',
    'Related locations': 'ទីកន្លែងពាក់ព័ន្ធ',
    Coordinates: 'កូអរដោនេ',
    'Approximate location, the marker is an estimated point':
        'ទីតាំងប្រហាក់ប្រហែល សញ្ញាសម្គាល់ជាចំណុចប៉ាន់ស្មាន',
    'Open in Google Maps': 'បើកក្នុង Google Maps',
    'Open in bible lookup': 'បើកក្នុងការស្វែងរកព្រះគម្ពីរ',
    'Show more': 'បង្ហាញបន្ថែម',
};
function sanitizeTranKey(key: string) {
    return key.trim().toLowerCase();
}
const duplicateKeys = Object.entries(dictionary)
    .filter(([key], index, self) => {
        const sanitizedKey = sanitizeTranKey(key);
        return (
            self.findIndex(([k]) => sanitizeTranKey(k) === sanitizedKey) !==
            index
        );
    })
    .map(([key]) => key);
if (duplicateKeys.length > 0) {
    throw new Error(
        'Duplicate translation keys found after sanitization: ' +
            duplicateKeys.join(', '),
    );
}

const sanitizedDictionary = Object.fromEntries(
    Object.entries(dictionary).map(([key, value]) => [
        sanitizeTranKey(key),
        value,
    ]),
);
const fontFamily = 'app-Battambang';
const globalFontFamily = 'Battambang';
const stickyNoteFontFamily = 'km-font-Fasthand';
const lang: LanguageDataType = {
    packageDir: __dirname,
    version: '0.0.1',
    locale: 'km-KH',
    langCode: 'km',
    customMenusData: {
        tools: [
            {
                label: 'Khmer Tools',
                submenu: [
                    {
                        label: 'Editor',
                        clickData: {
                            openExternalUrl:
                                'https://editor-km.openworship.app',
                        },
                    },
                    {
                        label: 'Open Lyric',
                        clickData: {
                            openExternalUrl: 'https://lyric-km.openworship.app',
                        },
                    },
                    {
                        label: 'BibleNote',
                        clickData: {
                            openExternalUrl:
                                'https://biblenote-km.openworship.app',
                        },
                    },
                ],
            },
        ],
    },
    editorLink: 'https://editor-km.openworship.app',
    bibleBooks,
    checkIsThisLang: (text: string) => {
        return /[\u1780-\u17FF]/u.test(text);
    },
    getFontFamilyFiles: () => {
        return [btbRegular, btbBold, btbLight, btbThin, btbBlack, fhRegular];
    },
    genCss: () => {
        return `
        @font-face {
            font-family: ${fontFamily};
            src: url(${btbRegular}) format("truetype");
            font-weight: normal;
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
        @font-face {
            font-family: ${stickyNoteFontFamily};
            src: url(${fhRegular}) format("truetype");
            font-weight: normal;
        }
        `;
    },
    fontFamily,
    globalFontFamily,
    stickyNoteFontFamily,
    numList,
    dictionary: sanitizedDictionary,
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
    sanitizeTranKey,
    transformBibleBookName: (bookName: string) => {
        // ពេត្រុសទី១ => ១ ពេត្រុស
        bookName = bookName.trim();
        const arr = bookName.split('ទី');
        if (
            arr.length > 1 &&
            numList.includes(arr[1].trim()) &&
            arr[0].trim().length > 0
        ) {
            return [bookName, `${arr[1].trim()} ${arr[0].trim()}`];
        }
        return [bookName];
    },
    getBibleCrossRefBundleFilePath() {
        return resolveGzBundleFilePath(bbCR);
    },
    initOpenLyricPlugins: ({ editor, openLyric, openLyricMarkdownManager }) => {
        editor?.addPlugin('km-KH', new EditorPluginKmKh());
        const option = {
            title: 'Khmer',
            fontFaces: [fontFamily],
            indexRange: 2,
        };
        if (openLyric !== undefined) {
            const newFontFaces = genOpenLyricFontFaces(
                (openLyric.fontFaces as any) ?? [],
                { ...option },
            );
            openLyric.fontFaces = newFontFaces;
        }
        if (openLyricMarkdownManager !== undefined) {
            const newFontFaces = genOpenLyricFontFaces(
                (openLyricMarkdownManager.fontFaces as any) ?? [],
                { ...option },
            );
            openLyricMarkdownManager.fontFaces = newFontFaces;
        }
    },
};

export default lang;
