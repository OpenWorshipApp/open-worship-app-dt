import { EditorPluginKmKh } from 'open-lyric-plugin-km-kh';

import { type LanguageDataType } from '../../langHelpers';

import btbBlack from './fonts/Battambang/Battambang-Black.ttf';
import btbBold from './fonts/Battambang/Battambang-Bold.ttf';
import btbLight from './fonts/Battambang/Battambang-Light.ttf';
import btbRegular from './fonts/Battambang/Battambang-Regular.ttf';
import btbThin from './fonts/Battambang/Battambang-Thin.ttf';
import fhRegular from './fonts/Fasthand/Fasthand-Regular.ttf';

import bibleBooks from './bibleBooks.json';
import bibleKeyMap from './bibleKeyMap.json';
import bbCR from './bb-cr.gz.bundle';
import locationsMapUrl from './location-name-map-data/locationsMap.json?url';
import namesMapUrl from './location-name-map-data/namesMap.json?url';

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
    'Ask about what you are reading': 'សួរអំពីអ្វីដែលអ្នកកំពុងអាន',
    'Use Ask the Assistant About This Passage, Ask the Assistant About This Verse, or Ask the Assistant About This File to ask about that material.':
        'ប្រើ សួរជំនួយការអំពីបទគម្ពីរនេះ សួរជំនួយការអំពីខគម្ពីរនេះ ឬ សួរជំនួយការអំពីឯកសារនេះ ដើម្បីសួរអំពីខ្លឹមសារនោះ។',
    'For a missing Bible, choose Create the provided KJV, Let the assistant import a Bible for me, or Go to Bible Setting; you decide what to install.':
        'សម្រាប់ព្រះគម្ពីរដែលខ្វះ ជ្រើស បង្កើត KJV ដែលផ្តល់ជូន ឱ្យជំនួយការនាំចូលព្រះគម្ពីរមួយសម្រាប់ខ្ញុំ ឬ ទៅកាន់ការកំណត់ព្រះគម្ពីរ។ អ្នកសម្រេចថាត្រូវដំឡើងអ្វី។',
    // Built-in song draft summaries and extraction notes.
    'Musical key': 'សូរគន្លឹះ',
    Tempo: 'ល្បឿនចង្វាក់',
    'Time signature': 'រង្វាស់ចង្វាក់',
    'Song: {title}': 'ចម្រៀង៖ {title}',
    'by {author}': 'ដោយ {author}',
    'key {key}': 'សូរគន្លឹះ {key}',
    '{tempo} beats/min': '{tempo} ចង្វាក់/នាទី',
    'Sections ({count}): {sections}': 'ផ្នែក ({count})៖ {sections}',
    '{count} line': '{count} បន្ទាត់',
    '{count} lines': '{count} បន្ទាត់',
    'Play order: {order}': 'លំដាប់ច្រៀង៖ {order}',
    'there was no title in the text, so it is "Untitled"':
        'អត្ថបទគ្មានចំណងជើង ដូច្នេះវាត្រូវបានដាក់ឈ្មោះថា "Untitled"',
    'nobody was named as the author': 'គ្មានឈ្មោះអ្នកនិពន្ធត្រូវបានបញ្ជាក់',
    'the address the words came from is kept with the song, in its attachments, so whoever opens the file can see where they came from':
        'អាសយដ្ឋានប្រភពអត្ថបទត្រូវបានរក្សាជាមួយចម្រៀង ក្នុងតំណភ្ជាប់របស់វា ដើម្បីឲ្យអ្នកបើកឯកសារអាចដឹងប្រភព',
    'the text had no section labels, so each block of lines was read as a verse':
        'អត្ថបទគ្មានស្លាកផ្នែក ដូច្នេះបណ្ដុំបន្ទាត់នីមួយៗត្រូវបានចាត់ទុកជាឃ្លាចម្រៀងមួយ',
    'a block that came round again word for word was written once and played each time it appeared -- check that is really the chorus':
        'បណ្ដុំអត្ថបទដែលកើតឡើងដដែលត្រូវបានសរសេរតែមួយដង ហើយច្រៀងរាល់ពេលដែលវាលេចឡើង — សូមពិនិត្យថាវាពិតជាបន្ទរ',
    'the sections could not be worked out, so every block was kept as free text with its own label above it -- the words are all there, and the section names may want setting by hand':
        'មិនអាចកំណត់ផ្នែកបានទេ ដូច្នេះបណ្ដុំនីមួយៗត្រូវបានរក្សាជាអត្ថបទធម្មតា ជាមួយស្លាករបស់វានៅខាងលើ — ពាក្យទាំងអស់នៅគ្រប់ ហើយអ្នកអាចកំណត់ឈ្មោះផ្នែកដោយខ្លួនឯង',
    'The text did not specify {fields}; add them if needed.':
        'អត្ថបទមិនបានបញ្ជាក់ {fields} ទេ។ សូមបន្ថែមបើចាំបាច់។',
    'The supplied {fields} were not recognized and were left out; set them by hand.':
        'មិនស្គាល់ {fields} ដែលបានផ្ដល់ឲ្យទេ ដូច្នេះវាត្រូវបានទុកចោល។ សូមកំណត់ដោយខ្លួនឯង។',
    '{count} heading lines above the first numbered verse were left out.':
        'បានទុកចោលបន្ទាត់ចំណងជើង {count} នៅខាងលើឃ្លាចម្រៀងមានលេខដំបូង។',
    '{count} lines in another language were kept as translations of the lines above them.':
        'បានរក្សាបន្ទាត់ {count} ជាភាសាផ្សេង ជាសេចក្ដីបកប្រែនៃបន្ទាត់នៅខាងលើវា។',
    'The song was taken from "{first}" to "{last}" on the page.':
        'បានយកចម្រៀងពី "{first}" ដល់ "{last}" នៅលើទំព័រ។',
    '{count} lines of menus, chord charts and links were left out.':
        'បានទុកចោលបន្ទាត់ម៉ឺនុយ តារាងអង្កត់ធ្នូ និងតំណ ចំនួន {count}។',
    'If that includes too much or too little, say where the song starts and ends.':
        'បើវារួមបញ្ចូលច្រើនពេក ឬតិចពេក សូមប្រាប់ថាចម្រៀងចាប់ផ្ដើម និងបញ្ចប់នៅត្រង់ណា។',
    'Page buttons left out of the song: {words}':
        'ប៊ូតុងទំព័រដែលបានដកចេញពីចម្រៀង៖ {words}',
    'Credits left out of the sung words: {words}':
        'ព័ត៌មានឈ្មោះអ្នករួមចំណែកដែលបានដកចេញពីពាក្យច្រៀង៖ {words}',
    '{parts} could not form separate sections and were kept as free text.':
        '{parts} មិនអាចបង្កើតជាផ្នែកដាច់ដោយឡែកបានទេ ដូច្នេះវាត្រូវបានរក្សាជាអត្ថបទធម្មតា។',
    'Let the assistant import a Bible for me':
        'ឱ្យជំនួយការនាំចូលព្រះគម្ពីរជំនួសខ្ញុំ',
    // Bible Find's 🤖, at the end of the All Books row.
    'Find a Verse with the Assistant': 'ស្វែងរកខគម្ពីរជាមួយជំនួយការ',
    'It finds Bibles in your language and asks you a few simple questions.':
        'វាស្វែងរកព្រះគម្ពីរជាភាសារបស់អ្នក ហើយសួរសំណួរងាយៗតែពីរបីប៉ុណ្ណោះ។',
    'It will use the link you typed below.':
        'វានឹងប្រើតំណដែលអ្នកបានវាយខាងក្រោម។',
    // --- The "Bible key … is not available!" card: the assistant imports
    // that Bible. `Install it` is a button of the help window, quoted as it
    // reads there -- in the app's language.
    'Or let the assistant import this Bible for you:':
        'ឬឱ្យជំនួយការនាំចូលព្រះគម្ពីរនេះជំនួសអ្នក៖',
    'Press the button below. The assistant opens and looks for this Bible in a free collection online.':
        'ចុចប៊ូតុងខាងក្រោម។ ជំនួយការនឹងបើក ហើយស្វែងរកព្រះគម្ពីរនេះក្នុងបណ្ណសារឥតគិតថ្លៃនៅលើអ៊ីនធឺណិត។',
    'Press the Bible you want in its list, or type its language when it asks.':
        'ចុចព្រះគម្ពីរដែលអ្នកចង់បានក្នុងបញ្ជីរបស់វា ឬវាយភាសារបស់ព្រះគម្ពីរនៅពេលវាសួរ។',
    'Keep the short name it suggests, answer its other questions, then press Install it. The Bible shows here by itself.':
        'រក្សាឈ្មោះខ្លីដែលវាស្នើ ឆ្លើយសំណួរផ្សេងទៀតរបស់វា រួចចុច «ដំឡើង»។ ព្រះគម្ពីរនឹងបង្ហាញនៅទីនេះដោយខ្លួនឯង។',
    'Let the assistant import this Bible for me':
        'ឱ្យជំនួយការនាំចូលព្រះគម្ពីរនេះជំនួសខ្ញុំ',
    'Or let the assistant import a Bible in your language for you:':
        'ឬឱ្យជំនួយការនាំចូលព្រះគម្ពីរជាភាសារបស់អ្នកសម្រាប់អ្នក៖',
    'Press the button below. The assistant opens and looks for a Bible in your language in a free collection online.':
        'ចុចប៊ូតុងខាងក្រោម។ ជំនួយការនឹងបើក ហើយរកមើលព្រះគម្ពីរជាភាសារបស់អ្នកក្នុងបណ្ដុំឥតគិតថ្លៃនៅលើអ៊ីនធឺណិត។',
    'Keep the short name it suggests, answer its other questions, then press Install it. Then choose it in the list above; this card goes away.':
        'រក្សាឈ្មោះខ្លីដែលវាស្នើ ឆ្លើយសំណួរផ្សេងទៀតរបស់វា រួចចុច «ដំឡើង»។ បន្ទាប់មកជ្រើសរើសវាក្នុងបញ្ជីខាងលើ; កាតនេះនឹងបាត់ទៅវិញ។',
    'Could not check installed Bible keys':
        'មិនអាចពិនិត្យកូនសោព្រះគម្ពីរដែលបានដំឡើង',
    'Saving...': 'កំពុងរក្សាទុក...',
    'Find more editions': 'ស្វែងរកកំណែបន្ថែម',
    'Review Bible import': 'ពិនិត្យការនាំចូលព្រះគម្ពីរ',
    'Review the language and mappings before importing. The file name is only a language hint.':
        'ពិនិត្យភាសា និងការផ្គូផ្គងមុននាំចូល។ ឈ្មោះឯកសារគ្រាន់តែជាតម្រុយអំពីភាសាប៉ុណ្ណោះ។',
    'Choose a valid locale': 'ជ្រើសរើសភាសាដែលត្រឹមត្រូវ',
    'Number mapping': 'ការផ្គូផ្គងលេខ',
    Recommended: 'បានណែនាំ',
    'Book name mapping': 'ការផ្គូផ្គងឈ្មោះកណ្ឌគម្ពីរ',
    'Keep existing book names': 'រក្សាឈ្មោះកណ្ឌគម្ពីរដែលមានស្រាប់',
    'Searching online for Bible book names...':
        'កំពុងស្វែងរកឈ្មោះកណ្ឌគម្ពីរតាមអ៊ីនធឺណិត...',
    'Some online sources are unavailable. You can keep the existing names or try another locale.':
        'ប្រភពអនឡាញខ្លះមិនអាចប្រើបាន។ អ្នកអាចរក្សាឈ្មោះដែលមានស្រាប់ ឬសាកល្បងភាសាផ្សេង។',
    'Preview book names': 'មើលឈ្មោះកណ្ឌគម្ពីរជាមុន',
    'Built-in names': 'ឈ្មោះដែលមានក្នុងកម្មវិធី',
    'Search for more book name lists': 'ស្វែងរកបញ្ជីឈ្មោះកណ្ឌគម្ពីរបន្ថែម',
    'Invalid Bible key': 'កូនសោព្រះគម្ពីរមិនត្រឹមត្រូវ',
    'Screen Mirror': 'ការឆ្លុះអេក្រង់',
    'Connection code is incorrect': 'លេខកូដតភ្ជាប់មិនត្រឹមត្រូវ',
    'Disconnected by host': 'ម៉ាស៊ីនមេបានផ្តាច់ការតភ្ជាប់',
    'Incompatible or duplicate connection': 'ការតភ្ជាប់មិនត្រូវគ្នា ឬស្ទួន',
    'Screen Mirror Connection': 'ការតភ្ជាប់អេក្រង់ឆ្លុះ',
    'Full screen': 'ពេញអេក្រង់',
    'Exit full screen': 'ចេញពីពេញអេក្រង់',
    'Catching up': 'កំពុងតាមឱ្យទាន់',
    'behind live': 'យឺតជាងផ្សាយផ្ទាល់',
    'Cast to a TV': 'បញ្ចាំងទៅទូរទស្សន៍',
    Cast: 'បញ្ចាំង',
    Casting: 'កំពុងបញ្ចាំង',
    'Search again': 'ស្វែងរកម្ដងទៀត',
    'Looking for TVs…': 'កំពុងស្វែងរកទូរទស្សន៍…',
    'No TV found. Make sure the TV is on and on the same network as this computer.':
        'រកមិនឃើញទូរទស្សន៍ទេ។ សូមប្រាកដថាទូរទស្សន៍បានបើក ហើយនៅលើបណ្ដាញតែមួយជាមួយកុំព្យូទ័រនេះ។',
    'Turn on “Let other devices watch” to cast to a TV.':
        'សូមបើក «អនុញ្ញាតឱ្យឧបករណ៍ផ្សេងមើល» ដើម្បីបញ្ចាំងទៅទូរទស្សន៍។',
    'That TV was not found. Search again.':
        'រកមិនឃើញទូរទស្សន៍នោះទេ។ សូមស្វែងរកម្ដងទៀត។',
    'The TV could not be reached.': 'មិនអាចភ្ជាប់ទៅទូរទស្សន៍បានទេ។',
    'The TV could not play this display.':
        'ទូរទស្សន៍មិនអាចចាក់អេក្រង់នេះបានទេ។',
    'The TV did not answer.': 'ទូរទស្សន៍មិនបានឆ្លើយតបទេ។',
    'The TV stopped playing.': 'ទូរទស្សន៍បានឈប់ចាក់។',
    'No TV was found that can play this display. It must be on and on the same network.':
        'រកមិនឃើញទូរទស្សន៍ដែលអាចចាក់អេក្រង់នេះទេ។ វាត្រូវតែបើក ហើយនៅលើបណ្ដាញតែមួយ។',
    'Turn off sound': 'បិទសំឡេង',
    'Voice volume': 'កម្រិតសំឡេងនិយាយ',
    'Turn on sound': 'បើកសំឡេង',
    'Waiting for the display': 'កំពុងរង់ចាំម៉ូនីទ័រ',
    'Watch in a browser': 'មើលក្នុងកម្មវិធីរុករក',
    'Where to watch': 'កន្លែងសម្រាប់មើល',
    'More addresses': 'អាសយដ្ឋានផ្សេងទៀត',
    'Cast from this browser': 'បញ្ចាំងពីកម្មវិធីរុករកនេះ',
    'For a TV on the same network as this device.':
        'សម្រាប់ទូរទស្សន៍នៅលើបណ្តាញតែមួយជាមួយឧបករណ៍នេះ។',
    'This browser found no TV. It must be on and on the same network as this device.':
        'កម្មវិធីរុករកនេះរកមិនឃើញទូរទស្សន៍ទេ។ ទូរទស្សន៍ត្រូវតែបើក ហើយនៅលើបណ្តាញតែមួយជាមួយឧបករណ៍នេះ។',
    'This browser cannot cast. Try Chrome, Edge or Safari.':
        'កម្មវិធីរុករកនេះមិនអាចបញ្ចាំងបានទេ។ សាកល្បង Chrome, Edge ឬ Safari។',
    'TVs on the app’s network': 'ទូរទស្សន៍នៅលើបណ្តាញរបស់កម្មវិធី',
    'Several screens show on this display, stacked: the one shown last is on top.':
        'អេក្រង់ច្រើនបង្ហាញលើអេក្រង់បង្ហាញនេះ ត្រួតលើគ្នា៖ អេក្រង់ដែលបង្ហាញចុងក្រោយនៅខាងលើ។',
    'Allow interaction': 'អនុញ្ញាតឲ្យប៉ះ និងរំកិល',
    'Allow again': 'អនុញ្ញាតម្ដងទៀត',
    'This device was disconnected. Ask whoever runs the display to let it back in.':
        'ឧបករណ៍នេះត្រូវបានផ្ដាច់។ សូមសុំអ្នកដែលគ្រប់គ្រងម៉ូនីទ័រឲ្យអនុញ្ញាតវាម្ដងទៀត។',
    'Lets this viewer scroll and pick verses in the app':
        'អនុញ្ញាតឲ្យអ្នកមើលនេះរំកិល និងជ្រើសខគម្ពីរក្នុងកម្មវិធី',
    'Video for media players (MP4)': 'វីដេអូសម្រាប់កម្មវិធីចាក់មេឌៀ (MP4)',
    Browser: 'កម្មវិធីរុករក',
    'This computer cannot encode AAC audio, so the video has no sound.':
        'កុំព្យូទ័រនេះមិនអាចអ៊ិនកូដសំឡេង AAC បានទេ ដូច្នេះវីដេអូគ្មានសំឡេងទេ។',
    'Virtual Screens Manager': 'កម្មវិធីគ្រប់គ្រងអេក្រង់និម្មិត',
    'Virtual Displays': 'ម៉ូនីទ័រនិម្មិត',
    'Virtual Display': 'ម៉ូនីទ័រនិម្មិត',
    Virtual: 'និម្មិត',
    'Add Virtual Display': 'បន្ថែមម៉ូនីទ័រនិម្មិត',
    'Manage Virtual Displays': 'គ្រប់គ្រងម៉ូនីទ័រនិម្មិត',
    'Delete Virtual Display': 'លុបម៉ូនីទ័រនិម្មិត',
    'Too many virtual displays': 'ម៉ូនីទ័រនិម្មិតច្រើនពេក',
    'Virtual display not found': 'រកមិនឃើញម៉ូនីទ័រនិម្មិត',
    'Let other devices watch': 'អនុញ្ញាតឲ្យឧបករណ៍ផ្សេងមើល',
    'Turn this on to watch virtual displays from phones, TVs and other computers on this network.':
        'បើកវាដើម្បីមើលម៉ូនីទ័រនិម្មិតពីទូរស័ព្ទ ទូរទស្សន៍ និងកុំព្យូទ័រផ្សេងទៀតនៅលើបណ្ដាញនេះ។',
    'Use HTTPS': 'ប្រើ HTTPS',
    'Browsers on other devices open the display by an https address, so a phone can keep its screen on and share its microphone and camera. This computer signs its own certificate, so each browser warns once: continue past the warning (Advanced, then Proceed). Media players keep the http address.':
        'កម្មវិធីរុករកនៅលើឧបករណ៍ផ្សេងទៀតបើកម៉ូនីទ័រតាមអាសយដ្ឋាន https ដូច្នេះទូរស័ព្ទអាចរក្សាអេក្រង់ឲ្យភ្លឺ ហើយចែករំលែកមីក្រូហ្វូន និងកាមេរ៉ារបស់វាបាន។ កុំព្យូទ័រនេះចុះហត្ថលេខាលើវិញ្ញាបនបត្រផ្ទាល់ខ្លួន ដូច្នេះកម្មវិធីរុករកនីមួយៗព្រមានម្ដង៖ សូមបន្តហួសការព្រមាននោះ (Advanced រួច Proceed)។ កម្មវិធីចាក់មេឌៀនៅតែប្រើអាសយដ្ឋាន http។',
    'Unable to turn on HTTPS': 'មិនអាចបើក HTTPS បានទេ',
    'Anyone who has a stream address can watch it, and the stream is not encrypted. Turn this off when you are done.':
        'អ្នកណាដែលមានអាសយដ្ឋានផ្សាយ អាចមើលវាបាន ហើយការផ្សាយមិនត្រូវបានអ៊ិនគ្រីបទេ។ សូមបិទវាពេលអ្នកប្រើរួច។',
    'A virtual display is a screen that exists only in this app. Show screens on it like on a real monitor, and watch it from any device as a video.':
        'ម៉ូនីទ័រនិម្មិត គឺជាអេក្រង់ដែលមានតែនៅក្នុងកម្មវិធីនេះ។ បង្ហាញអេក្រង់លើវាដូចលើម៉ូនីទ័រពិត ហើយមើលវាពីឧបករណ៍ណាមួយជាវីដេអូ។',
    Stopped: 'បានឈប់',
    'Starting…': 'កំពុងចាប់ផ្តើម…',
    Idle: 'ទំនេរ',
    Resolution: 'កម្រិតភាពច្បាស់',
    Custom: 'ផ្ទាល់ខ្លួន',
    'Changing the resolution restarts the stream for everyone watching.':
        'ការប្តូរកម្រិតភាពច្បាស់ នឹងចាប់ផ្តើមការផ្សាយឡើងវិញសម្រាប់អ្នកកំពុងមើលទាំងអស់។',
    Wallpaper: 'រូបផ្ទៃខាងក្រោយ',
    'None (black)': 'គ្មាន (ខ្មៅ)',
    'This app (preview)': 'កម្មវិធីនេះ (មើលជាមុន)',
    'Watching now': 'កំពុងមើលឥឡូវនេះ',
    'No one is watching': 'គ្មាននរណាកំពុងមើលទេ',
    'Screens showing on this virtual display will be hidden, and everyone watching it will be disconnected.':
        'អេក្រង់ដែលកំពុងបង្ហាញលើម៉ូនីទ័រនិម្មិតនេះនឹងត្រូវលាក់ ហើយអ្នកកំពុងមើលទាំងអស់នឹងត្រូវផ្តាច់។',
    'Screens on this display': 'អេក្រង់នៅលើម៉ូនីទ័រនេះ',
    'This computer cannot make MP4 video':
        'កុំព្យូទ័រនេះមិនអាចបង្កើតវីដេអូ MP4 បានទេ',
    'The virtual display stopped': 'ម៉ូនីទ័រនិម្មិតបានឈប់',
    'The virtual display stopped recording': 'ម៉ូនីទ័រនិម្មិតបានឈប់ថត',
    'Its virtual display is not available. Choose another display for this screen.':
        'ម៉ូនីទ័រនិម្មិតរបស់វាមិនអាចប្រើបានទេ។ សូមជ្រើសរើសម៉ូនីទ័រផ្សេងសម្រាប់អេក្រង់នេះ។',
    'The firewall is stopping other devices from reaching this app.':
        'ជញ្ជាំងភ្លើងកំពុងរារាំងឧបករណ៍ផ្សេងមិនឲ្យភ្ជាប់មកកម្មវិធីនេះ។',
    'This network is set as Public, and the firewall lets this app in only on private networks.':
        'បណ្ដាញនេះត្រូវបានកំណត់ជាសាធារណៈ ហើយជញ្ជាំងភ្លើងអនុញ្ញាតកម្មវិធីនេះតែលើបណ្ដាញឯកជនប៉ុណ្ណោះ។',
    'Set this network to Private, or allow this app on public networks in the firewall.':
        'កំណត់បណ្ដាញនេះជាឯកជន ឬអនុញ្ញាតកម្មវិធីនេះលើបណ្ដាញសាធារណៈនៅក្នុងជញ្ជាំងភ្លើង។',
    'Click Open firewall settings.': 'ចុច បើកការកំណត់ជញ្ជាំងភ្លើង។',
    'Click Change settings.': 'ចុច ប្តូរការកំណត់ (Change settings)។',
    'Find this app in the list and tick Private. Tick Public too if this network is public.':
        'រកកម្មវិធីនេះនៅក្នុងបញ្ជី ហើយធីក ឯកជន (Private)។ ធីក សាធារណៈ (Public) ផងដែរ ប្រសិនបើបណ្ដាញនេះជាសាធារណៈ។',
    'Click OK, then Check again.': 'ចុច OK រួចចុច ពិនិត្យម្តងទៀត។',
    'Click Options.': 'ចុច ជម្រើស (Options)។',
    'Find this app and set it to allow incoming connections, and turn off blocking all incoming connections.':
        'រកកម្មវិធីនេះ ហើយកំណត់ឲ្យអនុញ្ញាតការតភ្ជាប់ចូល និងបិទការរារាំងការតភ្ជាប់ចូលទាំងអស់។',
    'If another device cannot connect, allow this port in the firewall:':
        'ប្រសិនបើឧបករណ៍ផ្សេងមិនអាចភ្ជាប់បាន សូមអនុញ្ញាតច្រកនេះនៅក្នុងជញ្ជាំងភ្លើង៖',
    'Another security program on this computer may need to allow this app too.':
        'កម្មវិធីសុវត្ថិភាពផ្សេងទៀតនៅលើកុំព្យូទ័រនេះ ប្រហែលជាត្រូវអនុញ្ញាតកម្មវិធីនេះដែរ។',
    'Open firewall settings': 'បើកការកំណត់ជញ្ជាំងភ្លើង',
    'Open network settings': 'បើកការកំណត់បណ្ដាញ',
    'Check again': 'ពិនិត្យម្តងទៀត',
    'Screen mirror server is unavailable':
        'ម៉ាស៊ីនបម្រើអេក្រង់ឆ្លុះមិនអាចប្រើបាន',
    'Connect to host': 'តភ្ជាប់ទៅម៉ាស៊ីនមេ',
    Rescan: 'ស្វែងរកឡើងវិញ',
    'Host address': 'អាសយដ្ឋានម៉ាស៊ីនមេ',
    Port: 'ច្រក',
    'Port (optional)': 'ច្រក (ស្រេចចិត្ត)',
    'Connection code': 'លេខកូដតភ្ជាប់',
    Connect: 'តភ្ជាប់',
    Disconnect: 'ផ្តាច់ការតភ្ជាប់',
    'Connection status': 'ស្ថានភាពតភ្ជាប់',
    Connected: 'បានតភ្ជាប់',
    Disconnected: 'បានផ្តាច់ការតភ្ជាប់',
    Connecting: 'កំពុងតភ្ជាប់',
    'Waiting for host approval': 'កំពុងរង់ចាំការអនុញ្ញាតពីម៉ាស៊ីនមេ',
    'Connection failed': 'ការតភ្ជាប់បានបរាជ័យ',
    'Connected guests': 'ម៉ាស៊ីនភ្ញៀវដែលបានតភ្ជាប់',
    'No connected guests': 'គ្មានម៉ាស៊ីនភ្ញៀវបានតភ្ជាប់',
    'Connection request': 'សំណើតភ្ជាប់',
    'Allow connection': 'អនុញ្ញាតការតភ្ជាប់',
    'Reject connection': 'បដិសេធការតភ្ជាប់',
    'Host addresses': 'អាសយដ្ឋានម៉ាស៊ីនមេ',
    'Guest access': 'ការចូលប្រើរបស់ភ្ញៀវ',
    'Approve each connection': 'អនុញ្ញាតការតភ្ជាប់នីមួយៗ',
    'Require connection code': 'ទាមទារលេខកូដតភ្ជាប់',
    'Code is set': 'បានកំណត់លេខកូដ',
    'Set connection code': 'កំណត់លេខកូដតភ្ជាប់',
    'Custom port (next launch)': 'ច្រកផ្ទាល់ខ្លួន (ពេលបើកកម្មវិធីលើកក្រោយ)',
    'Save port': 'រក្សាទុកច្រក',
    'Let other computers connect': 'អនុញ្ញាតឲ្យកុំព្យូទ័រផ្សេងតភ្ជាប់',
    'Turn this on to use other computers on this network as extra screens.':
        'បើកវាដើម្បីប្រើកុំព្យូទ័រផ្សេងទៀតនៅលើបណ្ដាញនេះជាអេក្រង់បន្ថែម។',
    Host: 'ម៉ាស៊ីនមេ',
    'This computer': 'កុំព្យូទ័រនេះ',
    'Choose a host below': 'ជ្រើសរើសម៉ាស៊ីនមេខាងក្រោម',
    'On the host, click Allow connection.':
        'នៅលើម៉ាស៊ីនមេ សូមចុច «អនុញ្ញាតការតភ្ជាប់»។',
    'The host can now show its screens on these monitors.':
        'ឥឡូវនេះ ម៉ាស៊ីនមេអាចបង្ហាញអេក្រង់របស់វានៅលើម៉ូនីទ័រទាំងនេះ។',
    'Hosts on this network': 'ម៉ាស៊ីនមេនៅលើបណ្ដាញនេះ',
    'Looking for hosts…': 'កំពុងស្វែងរកម៉ាស៊ីនមេ…',
    'No host found. Open the app on the host and check that both computers are on the same network.':
        'រកមិនឃើញម៉ាស៊ីនមេទេ។ សូមបើកកម្មវិធីនៅលើម៉ាស៊ីនមេ ហើយពិនិត្យថាកុំព្យូទ័រទាំងពីរនៅលើបណ្ដាញតែមួយ។',
    'Connect by address': 'តភ្ជាប់តាមអាសយដ្ឋាន',
    'Leave empty unless the host uses a code.':
        'ទុកឲ្យទទេ លុះត្រាតែម៉ាស៊ីនមេប្រើលេខកូដ។',
    'Open to the internet': 'បើកឲ្យតភ្ជាប់តាមអ៊ីនធឺណិត',
    'Anyone who has the address can ask to connect, and the connection is not encrypted. Use a connection code, and turn this off when you are done.':
        'អ្នកណាដែលមានអាសយដ្ឋាននេះ អាចស្នើសុំតភ្ជាប់បាន ហើយការតភ្ជាប់មិនត្រូវបានអ៊ិនគ្រីបទេ។ សូមប្រើលេខកូដតភ្ជាប់ ហើយបិទវាវិញពេលអ្នករួចរាល់។',
    Internet: 'អ៊ីនធឺណិត',
    'This network': 'បណ្ដាញនេះ',
    Router: 'រ៉ោតទ័រ',
    'Public address': 'អាសយដ្ឋានសាធារណៈ',
    'Public IP': 'IP សាធារណៈ',
    'Public port': 'ច្រកសាធារណៈ',
    'The router would not open the chosen port, so it opened another one.':
        'រ៉ោតទ័រមិនព្រមបើកច្រកដែលបានជ្រើសរើសទេ ដូច្នេះវាបានបើកច្រកមួយផ្សេងទៀត។',
    Tunnel: 'ផ្លូវរូង',
    'Share through a Cloudflare tunnel': 'ចែករំលែកតាមផ្លូវរូង Cloudflare',
    'For when the internet cannot reach this computer, such as behind a VPN or a router that forwards no port. Guests and viewers come in through Cloudflare by an https address that changes each time the tunnel starts.':
        'សម្រាប់ពេលដែលអ៊ីនធឺណិតមិនអាចទៅដល់កុំព្យូទ័រនេះបាន ដូចជានៅពីក្រោយ VPN ឬរ៉ោតទ័រដែលមិនបញ្ជូនបន្តច្រកណាមួយ។ ភ្ញៀវ និងអ្នកមើលចូលមកតាម Cloudflare ដោយអាសយដ្ឋាន https ដែលប្ដូររាល់ពេលផ្លូវរូងចាប់ផ្ដើម។',
    'Starting the tunnel…': 'កំពុងចាប់ផ្ដើមផ្លូវរូង…',
    'The tunnel is up.': 'ផ្លូវរូងកំពុងដំណើរការ។',
    'The tunnel stopped. It starts again by itself.':
        'ផ្លូវរូងបានឈប់។ វានឹងចាប់ផ្ដើមម្ដងទៀតដោយខ្លួនឯង។',
    'The tunnel comes with the Extra Binaries. Install or update them in Settings, and it starts by itself.':
        'ផ្លូវរូងមកជាមួយកម្មវិធីបន្ថែម។ សូមដំឡើង ឬធ្វើបច្ចុប្បន្នភាពវានៅក្នុងការកំណត់ នោះវានឹងចាប់ផ្ដើមដោយខ្លួនឯង។',
    'The tunnel is not working.': 'ផ្លូវរូងមិនដំណើរការទេ។',
    'Send my microphone': 'ផ្ញើមីក្រូហ្វូនរបស់ខ្ញុំ',
    'Stop sending my microphone': 'ឈប់ផ្ញើមីក្រូហ្វូនរបស់ខ្ញុំ',
    'Play their microphone': 'ចាក់សំឡេងមីក្រូហ្វូនរបស់ពួកគេ',
    'Their microphone is on': 'មីក្រូហ្វូនរបស់ពួកគេកំពុងបើក',
    'Speaker volume': 'កម្រិតសំឡេងឧបករណ៍បំពងសំឡេង',
    'Share my cameras': 'ចែករំលែកកាមេរ៉ារបស់ខ្ញុំ',
    'Stop sharing my cameras': 'ឈប់ចែករំលែកកាមេរ៉ារបស់ខ្ញុំ',
    Share: 'ចែករំលែក',
    'Front camera': 'កាមេរ៉ាមុខ',
    'Back camera': 'កាមេរ៉ាក្រោយ',
    'Microphone access denied': 'មិនបានអនុញ្ញាតឲ្យប្រើមីក្រូហ្វូនទេ',
    'The microphone could not be opened. Allow it for this page, or close another app using it.':
        'មិនអាចបើកមីក្រូហ្វូនបានទេ។ សូមអនុញ្ញាតវាសម្រាប់ទំព័រនេះ ឬបិទកម្មវិធីផ្សេងដែលកំពុងប្រើវា។',
    'The camera could not be opened. Allow it for this page, or close another app using it.':
        'មិនអាចបើកកាមេរ៉ាបានទេ។ សូមអនុញ្ញាតវាសម្រាប់ទំព័រនេះ ឬបិទកម្មវិធីផ្សេងដែលកំពុងប្រើវា។',
    'Waiting for approval': 'កំពុងរង់ចាំការអនុញ្ញាត',
    'Waiting for the code': 'កំពុងរង់ចាំលេខកូដ',
    'Nothing is showing on this display yet.':
        'មិនទាន់មានអ្វីបង្ហាញនៅលើម៉ូនីទ័រនេះនៅឡើយទេ។',
    'Set a connection code: until then no one can come in with a code.':
        'សូមកំណត់លេខកូដតភ្ជាប់៖ រហូតដល់ពេលនោះ គ្មាននរណាម្នាក់អាចចូលដោយលេខកូដបានទេ។',
    'QR code': 'កូដ QR',
    'Copy address': 'ចម្លងអាសយដ្ឋាន',
    'Asking the router to open the port…': 'កំពុងស្នើរ៉ោតទ័រឲ្យបើកច្រក…',
    'The router opened the port.': 'រ៉ោតទ័របានបើកច្រករួចហើយ។',
    'This router is behind another network, so the internet cannot reach it. A VPN such as Tailscale works instead.':
        'រ៉ោតទ័រនេះនៅពីក្រោយបណ្ដាញមួយទៀត ដូច្នេះអ៊ីនធឺណិតមិនអាចទៅដល់វាបានទេ។ សូមប្រើ VPN ដូចជា Tailscale ជំនួសវិញ។',
    'No router answered.': 'គ្មានរ៉ោតទ័រណាឆ្លើយតបទេ។',
    'The router refused to open the port.': 'រ៉ោតទ័របានបដិសេធមិនបើកច្រក។',
    'Forward the port on the router to this computer, then type the public address below.':
        'សូមបញ្ជូនបន្តច្រកនៅលើរ៉ោតទ័រមកកុំព្យូទ័រនេះ រួចវាយអាសយដ្ឋានសាធារណៈនៅខាងក្រោម។',
    'Ask the router again': 'ស្នើរ៉ោតទ័រម្ដងទៀត',
    'An IPv6 address works only if the router lets incoming connections through.':
        'អាសយដ្ឋាន IPv6 ដំណើរការបាន លុះត្រាតែរ៉ោតទ័រអនុញ្ញាតឲ្យការតភ្ជាប់ចូលឆ្លងកាត់។',
    'Public address (optional)': 'អាសយដ្ឋានសាធារណៈ (ស្រេចចិត្ត)',
    'Save address': 'រក្សាទុកអាសយដ្ឋាន',
    'Connected from the internet': 'បានតភ្ជាប់តាមអ៊ីនធឺណិត',
    'Connected from this network': 'បានតភ្ជាប់ពីបណ្ដាញនេះ',
    'Invalid host or port': 'អាសយដ្ឋានម៉ាស៊ីនមេ ឬច្រកមិនត្រឹមត្រូវ',
    'Too many hosts': 'ម៉ាស៊ីនមេច្រើនពេក',
    'Too many wrong codes. Try again later.':
        'វាយលេខកូដខុសច្រើនដងពេក។ សូមព្យាយាមម្ដងទៀតពេលក្រោយ។',
    'Too many connection requests. Try again later.':
        'សំណើតភ្ជាប់ច្រើនពេក។ សូមព្យាយាមម្ដងទៀតពេលក្រោយ។',
    'No host address found in this image.':
        'រកមិនឃើញអាសយដ្ឋានម៉ាស៊ីនមេក្នុងរូបភាពនេះទេ។',
    'Choose a picture of a QR code, or paste one here.':
        'ជ្រើសរើសរូបភាពកូដ QR ឬបិទភ្ជាប់វានៅទីនេះ។',
    'Read QR code': 'អានកូដ QR',
    'Paste address': 'បិទភ្ជាប់អាសយដ្ឋាន',
    'Fill in a copied address, link or QR code picture.':
        'បំពេញដោយអាសយដ្ឋាន តំណ ឬរូបភាពកូដ QR ដែលបានចម្លង។',
    'No host address found in the clipboard.':
        'រកមិនឃើញអាសយដ្ឋានម៉ាស៊ីនមេក្នុងក្ដារតម្បៀតខ្ទាស់ទេ។',
    'Copy image': 'ចម្លងរូបភាព',
    'The QR code image has been copied to the clipboard':
        'រូបភាពកូដ QR ត្រូវបានចម្លងទៅក្ដារតម្បៀតខ្ទាស់ហើយ',
    'The QR code image could not be copied': 'មិនអាចចម្លងរូបភាពកូដ QR បានទេ',
    'HTML-in-Canvas': 'HTML-in-Canvas',
    'PDF.js': 'PDF.js',
    'Interactive text': 'អត្ថបទអន្តរកម្ម',
    'Mozilla viewer': 'កម្មវិធីមើល Mozilla',
    'Messy text': 'អត្ថបទចម្រុះ',
    'Hover for a title; click or right-click a text range to call the app.':
        'ដាក់កណ្ដុរដើម្បីមើលចំណងជើង ចុច ឬចុចស្ដាំលើចន្លោះអត្ថបទដើម្បីបញ្ជូនទៅកម្មវិធី។',
    'Extracted PDF text': 'អត្ថបទដែលបានស្រង់ពី PDF',
    'Text range source': 'ប្រភពចន្លោះអត្ថបទ',
    'Hover over text for its title; click a Bible reference for a verse.':
        'ដាក់កណ្ដុរលើអត្ថបទដើម្បីមើលចំណងជើង រួចចុចឯកសារយោងព្រះគម្ពីរដើម្បីមើលខ។',
    'Choose PDF': 'ជ្រើសរើស PDF',
    'Selected text': 'អត្ថបទដែលបានជ្រើសរើស',
    'No matching Bible verse found': 'រកមិនឃើញខគម្ពីរដែលត្រូវគ្នា',
    // Presenter-only practice lessons.
    'Type a complete reference in Bible Lookup':
        'វាយឯកសារយោងពេញលេញក្នុងការស្វែងរកព្រះគម្ពីរ',
    'Enter a book, chapter and verse range together, then check the preview.':
        'បញ្ចូលកណ្ឌ ជំពូក និងចន្លោះខជាមួយគ្នា រួចពិនិត្យមើលជាមុន។',
    'Keep Bible Lookup open between passages':
        'រក្សាការស្វែងរកព្រះគម្ពីរឱ្យនៅបើករវាងបទគម្ពីរ',
    'Use Keep Open when preparing several Bible passages in a row.':
        'ប្រើ រក្សាឱ្យនៅបើក ពេលរៀបចំបទគម្ពីរជាច្រើនជាបន្តបន្ទាប់។',
    'Reuse a passage from lookup history':
        'ប្រើបទគម្ពីរពីប្រវត្តិស្វែងរកឡើងវិញ',
    'Bring back an earlier reference from the history above Bible Lookup.':
        'យកឯកសារយោងមុនពីប្រវត្តិនៅខាងលើការស្វែងរកព្រះគម្ពីរមកវិញ។',
    'Explore study tools in Bible Lookup':
        'ស្វែងយល់ពីឧបករណ៍សិក្សាក្នុងការស្វែងរកព្រះគម្ពីរ',
    'Find words, cross references and local Resources without leaving the Presenter.':
        'ស្វែងរកពាក្យ ឯកសារយោងឆ្លង និងធនធានក្នុងម៉ាស៊ីន ដោយមិនចាកចេញពីផ្ទាំងបង្ហាញ។',
    'Find media by its file name': 'ស្វែងរកមេឌៀតាមឈ្មោះឯកសារ',
    'Use the Background name filter to narrow a busy media folder.':
        'ប្រើតម្រងឈ្មោះក្នុងផ្ទាំងផ្ទៃខាងក្រោយ ដើម្បីបង្រួមបញ្ជីមេឌៀ។',
    'Sort a media folder before the service': 'តម្រៀបថតមេឌៀមុនការថ្វាយបង្គំ',
    'Open Background Sort to choose the order of media files.':
        'បើក តម្រៀប ក្នុងផ្ទាំងផ្ទៃខាងក្រោយ ដើម្បីជ្រើសរើសលំដាប់ឯកសារមេឌៀ។',
    'Check which media folder is open': 'ពិនិត្យថាតើថតមេឌៀណាកំពុងបើក',
    'Reveal the Background path editor when an expected file is missing.':
        'បង្ហាញប្រអប់កែផ្លូវក្នុងផ្ទាំងផ្ទៃខាងក្រោយ ពេលរកឯកសារដែលចង់បានមិនឃើញ។',
    'Find a service flow by name': 'ស្វែងរកលំដាប់ថ្វាយបង្គំតាមឈ្មោះ',
    'Filter the Presenting Flow List to find the right service order.':
        'ត្រងបញ្ជីលំដាប់បង្ហាញ ដើម្បីរកលំដាប់ថ្វាយបង្គំដែលត្រឹមត្រូវ។',
    'Organize the list of service flows': 'រៀបចំបញ្ជីលំដាប់ថ្វាយបង្គំ',
    'Use Presenting Flow List Sort without rearranging the cues inside a flow.':
        'តម្រៀបបញ្ជីលំដាប់បង្ហាញ ដោយមិនប្ដូរលំដាប់ជំហាននៅក្នុងវា។',
    'Prepare several audience messages': 'រៀបចំសារជាច្រើនសម្រាប់អ្នកចូលរួម',
    'Use Messages for separate notices with their own Show and Hide controls.':
        'ប្រើ សារ សម្រាប់សេចក្ដីជូនដំណឹងដាច់ដោយឡែក ដែលមានប៊ូតុងបង្ហាញ និងលាក់រៀងៗខ្លួន។',
    'Rotate notices before the service':
        'ប្ដូរសេចក្ដីជូនដំណឹងជាបន្តបន្ទាប់មុនការថ្វាយបង្គំ',
    'Use Messages Rotate and its seconds setting for a repeating notice board.':
        'ប្រើការប្ដូរសារវេនគ្នា និងការកំណត់វិនាទី ដើម្បីបង្ហាញសេចក្ដីជូនដំណឹងម្ដងហើយម្ដងទៀត។',
    'Give audience messages room to breathe':
        'បន្ថែមចន្លោះឱ្យសារសម្រាប់អ្នកចូលរួមងាយអាន',
    'Use Messages Properties and Effects for padding, line height and text contrast.':
        'ប្រើ លក្ខណសម្បត្តិ និងបែបផែនរបស់សារ ដើម្បីកំណត់ចន្លោះក្នុងប្រអប់ កម្ពស់បន្ទាត់ និងភាពច្បាស់នៃអក្សរ។',
    'Find border and shadow effects for an overlay':
        'រកបែបផែនស៊ុម និងស្រមោលសម្រាប់ធាតុជាន់ពីលើ',
    'Open Quick Text, then explore the Effects section inside Properties.':
        'បើក អត្ថបទរហ័ស រួចស្វែងយល់ពីផ្នែកបែបផែនក្នុងលក្ខណសម្បត្តិ។',
    'Prepare an image overlay slide show':
        'រៀបចំការបង្ហាញរូបភាពជាបន្តបន្ទាប់ជាន់ពីលើ',
    'Find Image Show slide show controls and timing options before starting playback.':
        'រកឧបករណ៍បញ្ជា និងការកំណត់ពេលក្នុងផ្ទាំងបង្ហាញរូបភាព មុនចាប់ផ្ដើមចាក់។',
    'Background > Videos': 'Background > វីដេអូ',
    'Background > Images': 'Background > រូបភាព',
    'Background > Filter by name': 'Background > ត្រងតាមឈ្មោះ',
    'Background > Sort': 'Background > តម្រៀប',
    'Background > Show path editor': 'Background > Show path editor',
    'Presenting Flow List > Sort': 'Presenting Flow List > តម្រៀប',
    'Presenting Flow List > Filter by name':
        'Presenting Flow List > ត្រងតាមឈ្មោះ',
    'Messages > Properties': 'Messages > លក្ខណសម្បត្តិ',
    'Quick Text > Properties': 'Quick Text > លក្ខណសម្បត្តិ',
    'Image Show > Properties': 'Image Show > លក្ខណសម្បត្តិ',
    'Applies to each app page on the next launch.':
        'អនុវត្តចំពោះទំព័រនីមួយៗរបស់កម្មវិធី នៅពេលបើកលើកក្រោយ។',
    'Explore General settings': 'ស្វែងយល់ពីការកំណត់ទូទៅ',
    'Choose your data folder': 'ជ្រើសថតទិន្នន័យរបស់អ្នក',
    'Path Settings holds your data folder, where your songs, Bibles and settings are kept: choose it under Parent Directory, and copy it to a drive with Copy Data Folder.':
        'ការកំណត់ផ្លូវ កាន់ថតទិន្នន័យរបស់អ្នក ដែលទុកបទចម្រៀង ព្រះគម្ពីរ និងការកំណត់របស់អ្នក៖ ជ្រើសវានៅក្រោម ថតមេ ហើយចម្លងវាទៅថាសផ្សេង ដោយ ចម្លងថតទិន្នន័យ។',
    'Manage Bible versions': 'គ្រប់គ្រងកំណែព្រះគម្ពីរ',
    'Find AI and extra tools': 'ស្វែងរក AI និងឧបករណ៍បន្ថែម',
    'Bible Note': 'កំណត់ត្រាព្រះគម្ពីរ',
    'Web Editor': 'កម្មវិធីកែសម្រួលទំព័របណ្ដាញ',
    'Lyric Editor': 'កម្មវិធីកែសម្រួលទំនុកច្រៀង',
    'Local Web Share': 'ចែករំលែកតាមបណ្ដាញមូលដ្ឋាន',
    'Explore folders, language, appearance, and automatic tips in General settings.':
        'ស្វែងយល់អំពីថត ភាសា រូបរាង និងគន្លឹះស្វ័យប្រវត្តិ ក្នុងការកំណត់ទូទៅ។',
    'Open Bible settings to manage the installed Bible versions.':
        'បើកការកំណត់ព្រះគម្ពីរ ដើម្បីគ្រប់គ្រងកំណែព្រះគម្ពីរដែលបានដំឡើង។',
    'Find AI features and extra binaries in Others settings.':
        'ស្វែងរកមុខងារ AI និងកម្មវិធីបន្ថែម ក្នុងការកំណត់ផ្សេងៗ។',
    'Select a slide, then select an item on its canvas to edit it.':
        'ជ្រើសស្លាយ រួចជ្រើសធាតុនៅលើផ្ទៃស្លាយ ដើម្បីកែសម្រួល។',
    'Review your slide edits before saving. Use Undo to reverse an edit.':
        'ពិនិត្យការកែសម្រួលស្លាយមុនពេលរក្សាទុក។ ប្រើ មិនធ្វើវិញ ដើម្បីត្រឡប់ការកែសម្រួល។',
    'Edit your note here, then use Save to keep your changes.':
        'កែសម្រួលកំណត់ត្រានៅទីនេះ រួចប្រើ រក្សាទុក ដើម្បីរក្សាការផ្លាស់ប្ដូរ។',
    'Edit the web page beside its preview and review it before saving.':
        'កែសម្រួលទំព័របណ្ដាញនៅក្បែរការមើលជាមុន ហើយពិនិត្យមុនពេលរក្សាទុក។',
    'Edit the song sections and check their preview before saving.':
        'កែសម្រួលផ្នែកនៃបទចម្រៀង ហើយពិនិត្យការមើលជាមុន មុនពេលរក្សាទុក។',
    'Start the server when you are ready to share, then use its address or QR code on the same network.':
        'ចាប់ផ្ដើមម៉ាស៊ីនមេនៅពេលអ្នករួចរាល់ដើម្បីចែករំលែក រួចប្រើអាសយដ្ឋាន ឬកូដ QR របស់វាលើបណ្ដាញតែមួយ។',
    // Reader demo titles and practical tips.
    'Find and replay Reader demos': 'ស្វែងរក និងអនុវត្តការបង្ហាញអ្នកអានឡើងវិញ',
    'Use Help > All tips, search a task, then choose Show it to practise one step at a time.':
        'ចូល ជំនួយ > គន្លឹះទាំងអស់ ស្វែងរកកិច្ចការ រួចជ្រើសបង្ហាញ ដើម្បីអនុវត្តម្តងមួយជំហាន។',
    'Copy only the passage reference': 'ចម្លងតែយោងបទគម្ពីរ',
    'Use Copy Title when you need a reference for an outline without the verse text.':
        'ប្រើ ចម្លងចំណងជើង ដើម្បីដាក់យោងក្នុងគ្រោងមេរៀន ដោយគ្មានអត្ថបទខគម្ពីរ។',
    'Copy only the Bible words': 'ចម្លងតែអត្ថបទគម្ពីរ',
    'Use Copy Text to paste the passage into your study notes without its title.':
        'ប្រើ ចម្លងអត្ថបទ ដើម្បីបិទភ្ជាប់បទគម្ពីរក្នុងកំណត់ត្រា ដោយគ្មានចំណងជើង។',
    'Copy the reference and Bible words': 'ចម្លងយោង និងអត្ថបទគម្ពីរ',
    'Use Copy All to keep the passage reference with the text you paste.':
        'ប្រើ ចម្លងទាំងអស់ ដើម្បីរក្សាយោងជាមួយអត្ថបទដែលអ្នកបិទភ្ជាប់។',
    'Copy a verse key for study files':
        'ចម្លងលេខសម្គាល់ខគម្ពីរសម្រាប់ឯកសារសិក្សា',
    'Use Copy Verse Full Key for a stable book, chapter and verse identifier.':
        'ប្រើ ចម្លងលេខសម្គាល់ខពេញ ដើម្បីយកលេខសម្គាល់សៀវភៅ ជំពូក និងខគម្ពីរ។',
    'Copy a chapter key for Resources': 'ចម្លងលេខសម្គាល់ជំពូកសម្រាប់ធនធាន',
    'Use Copy Chapter Full Key as the starting point for a chapter resource filename.':
        'ប្រើ ចម្លងលេខសម្គាល់ជំពូកពេញ ជាចំណុចចាប់ផ្តើមនៃឈ្មោះឯកសារធនធានជំពូក។',
    'Read the installed Bible information': 'អានព័ត៌មានគម្ពីរដែលបានដំឡើង',
    'Clear the reference, then open Bible Information to check the translation and publisher.':
        'សម្អាតយោង រួចបើកព័ត៌មានគម្ពីរ ដើម្បីពិនិត្យការបកប្រែ និងអ្នកបោះពុម្ព។',
    'Adjust or stop automatic scrolling':
        'កែតម្រូវ ឬបញ្ឈប់ការរមូរដោយស្វ័យប្រវត្តិ',
    'Double-click the bottom chevron to speed up, right-click to slow down, or Alt+right-click to stop.':
        'ចុចពីរដងលើព្រួញខាងក្រោមដើម្បីបង្កើនល្បឿន ចុចស្តាំដើម្បីបន្ថយ ឬ Alt+ចុចស្តាំដើម្បីបញ្ឈប់។',
    'Remove an extra Bible version': 'ដកកំណែគម្ពីរបន្ថែមចេញ',
    'Use the remove icon beside an extra version when you want one translation again.':
        'ប្រើរូបតំណាងដកចេញក្បែរកំណែបន្ថែម ពេលអ្នកចង់អានការបកប្រែតែមួយវិញ។',
    'Keep reading panes scrolling together': 'ឱ្យផ្ទាំងអានរមូរជាមួយគ្នា',
    'Give passages the same Color Note to scroll them together; Sync group scrolling turns that on or off.':
        'ផ្ដល់ ចំណាំពណ៌ ដូចគ្នាដល់បទគម្ពីរ ដើម្បីរំកិលជាមួយគ្នា; រំកិលក្រុមស្របគ្នា បើក ឬបិទវា។',
    'Split directly into another translation':
        'បំបែកផ្ទាំងទៅការបកប្រែផ្សេងដោយផ្ទាល់',
    'Use Split Horizontal to or Split Vertical to from a passage menu, then choose a Bible.':
        'ក្នុងម៉ឺនុយបទគម្ពីរ ប្រើបំបែកផ្ដេកទៅ ឬបំបែកបញ្ឈរទៅ រួចជ្រើសគម្ពីរ។',
    'Move between split passages with the keyboard':
        'ប្ដូររវាងបទគម្ពីរដែលបានបំបែក ដោយប្រើក្ដារចុច',
    'Press Ctrl+Shift with an arrow key to work in the passage on that side.':
        'ចុច Ctrl+Shift ជាមួយគ្រាប់ចុចព្រួញ ដើម្បីធ្វើការលើបទគម្ពីរនៅខាងនោះ។',
    'Move between split passages in Bible Lookup':
        'ប្ដូររវាងបទគម្ពីរដែលបានបំបែក ក្នុងការស្វែងរកព្រះគម្ពីរ',
    'Split a passage, then press Ctrl+Shift with an arrow key to work in the passage on that side.':
        'បំបែកបទគម្ពីរ រួចចុច Ctrl+Shift ជាមួយគ្រាប់ចុចព្រួញ ដើម្បីធ្វើការលើបទគម្ពីរនៅខាងនោះ។',
    'Choose the Bible formatting model': 'ជ្រើសម៉ូដែលរៀបចំទម្រង់គម្ពីរ',
    'Use Change Bible Model Info in the footer; choosing a different model reloads the Reader.':
        'ប្រើ ប្ដូរព័ត៌មានម៉ូដែលគម្ពីរ នៅបាតផ្ទាំង។ ការជ្រើសម៉ូដែលផ្សេងនឹងផ្ទុកអ្នកអានឡើងវិញ។',
    'Find the Reader saved-passage folder': 'រកថតបទគម្ពីរដែលអ្នកអានបានរក្សាទុក',
    'Use Show path editor in Bibles to see the folder; Choose a folder picks another, and right-click the path to Copy to Clipboard.':
        'ប្រើ Show path editor ក្នុង ព្រះគម្ពីរ ដើម្បីមើលថត; ជ្រើសរើសថត ជ្រើសថតផ្សេង ហើយចុចស្ដាំលើផ្លូវដើម្បី ចម្លងទៅកាន់ក្តារចុច។',
    'Create a saved Bible list': 'បង្កើតបញ្ជីបទគម្ពីរ',
    'Open Bibles > More Options > New File to keep passages for a study in their own list.':
        'បើក គម្ពីរ > ជម្រើសបន្ថែម > ឯកសារថ្មី ដើម្បីដាក់បទគម្ពីរសម្រាប់ការសិក្សាក្នុងបញ្ជីផ្ទាល់ខ្លួន។',
    'Reopen a saved passage in the Reader': 'បើកបទគម្ពីរដែលបានរក្សាទុកឡើងវិញ',
    'Expand a Bibles list, then double-click a passage or use Lookup in its menu; hold Shift to open it beside the current one.':
        'ពង្រីកបញ្ជី ព្រះគម្ពីរ រួចចុចពីរដងលើបទគម្ពីរ ឬប្រើ រកមើល ក្នុងម៉ឺនុយរបស់វា; សង្កត់ Shift ដើម្បីបើកវានៅក្បែរបទគម្ពីរបច្ចុប្បន្ន។',
    'Arrange saved Bible passages': 'រៀបចំបទគម្ពីរដែលបានរក្សាទុក',
    'Use a passage row menu for Duplicate, Move To, Move up, Move down or Delete, and its color circle to group it.':
        'ប្រើម៉ឺនុយជួរបទគម្ពីរ សម្រាប់ ស្ទួន ផ្លាស់ទីទៅ ផ្លាស់ទីឡើងលើ ផ្លាស់ទីចុះក្រោម ឬ លុប ហើយរង្វង់ពណ៌របស់វាដើម្បីដាក់ជាក្រុម។',
    'Import or export a Bible list': 'នាំចូល ឬនាំចេញបញ្ជីគម្ពីរ',
    'Export from a list file menu; Import or Import From URL from the Bibles panel menu.':
        'នាំចេញតាមម៉ឺនុយឯកសារបញ្ជី ហើយនាំចូល ឬនាំចូលពី URL តាមម៉ឺនុយផ្ទាំងគម្ពីរ។',
    'Manage saved Bible list files': 'គ្រប់គ្រងឯកសារបញ្ជីគម្ពីរ',
    'Right-click a list file for Rename, Duplicate, Empty, Copy Path to Clipboard, Reveal in File Explorer or Move to Trash.':
        'ចុចស្ដាំលើឯកសារបញ្ជី សម្រាប់ កែឈ្មោះ ស្ទួន ទទេ ចម្លងផ្លូវទៅកាន់ក្តារចុច បើកក្នុងកម្មវិធីរុករកឯកសារ ឬ ផ្លាស់ទីទៅធុងសំរាម។',
    'Find the Bible Notes folder': 'រកថតកំណត់ត្រាគម្ពីរ',
    'Use Show path editor in Bible Notes to locate your note library; Choose a folder picks another one.':
        'ប្រើ Show path editor ក្នុង កំណត់ត្រាព្រះគម្ពីរ ដើម្បីរកបណ្ណាល័យកំណត់ត្រារបស់អ្នក; ជ្រើសរើសថត ជ្រើសថតផ្សេង។',
    'Create a Bible Notes file': 'បង្កើតឯកសារកំណត់ត្រាគម្ពីរ',
    'Use Bible Notes > More Options > New File to group notes for a topic or study.':
        'ប្រើ កំណត់ត្រាគម្ពីរ > ជម្រើសបន្ថែម > ឯកសារថ្មី ដើម្បីចាត់ក្រុមកំណត់ត្រាតាមប្រធានបទ ឬការសិក្សា។',
    'Add a note to the right file': 'បន្ថែមកំណត់ត្រាក្នុងឯកសារដែលត្រូវការ',
    'Expand your chosen Bible Notes file, press its New Note Item plus button, then double-click a note to open it.':
        'ពង្រីកឯកសារ កំណត់ត្រាព្រះគម្ពីរ ដែលអ្នកជ្រើស ចុចប៊ូតុងបូក បង្កើតកំណត់ត្រាថ្មី រួចចុចពីរដងលើកំណត់ត្រាដើម្បីបើកវា។',
    'Arrange and move Bible note items': 'រៀបចំ និងផ្លាស់ទីកំណត់ត្រាគម្ពីរ',
    'Use a note row menu for Edit Title, Duplicate, Move To, Move up or Move down; Discard Change drops unsaved edits.':
        'ប្រើម៉ឺនុយជួរកំណត់ត្រា សម្រាប់ កែសម្រួលចំណងជើង ស្ទួន ផ្លាស់ទីទៅ ផ្លាស់ទីឡើងលើ ឬ ផ្លាស់ទីចុះក្រោម; បោះបង់ការផ្លាស់ប្តូរ បោះបង់ការកែដែលមិនទាន់រក្សាទុក។',
    'Import and export Bible notes': 'នាំចូល និងនាំចេញកំណត់ត្រាគម្ពីរ',
    'Import note files from the panel menu, import an item into a file, or Export the file or item you need.':
        'នាំចូលឯកសារកំណត់ត្រាពីម៉ឺនុយផ្ទាំង នាំចូលកំណត់ត្រាមួយក្នុងឯកសារ ឬនាំចេញឯកសារ ឬកំណត់ត្រាដែលត្រូវការ។',
    'Manage Bible Notes files': 'គ្រប់គ្រងឯកសារកំណត់ត្រាគម្ពីរ',
    'Use a note file menu for Rename, Duplicate, Copy All Items, Move All Items To, Reveal in File Explorer or Move to Trash.':
        'ប្រើម៉ឺនុយឯកសារកំណត់ត្រា សម្រាប់ កែឈ្មោះ ស្ទួន ចម្លងធាតុទាំងអស់ ផ្លាស់ទីធាតុទាំងអស់ទៅ បើកក្នុងកម្មវិធីរុករកឯកសារ ឬ ផ្លាស់ទីទៅធុងសំរាម។',
    'Search for words selected in a verse':
        'ស្វែងរកពាក្យដែលបានជ្រើសក្នុងខគម្ពីរ',
    'Select Bible words, right-click them, then choose Search in Bible Search.':
        'ជ្រើសពាក្យគម្ពីរ ចុចស្តាំ រួចជ្រើស ស្វែងរកក្នុងការស្វែងរកគម្ពីរ។',
    'Choose the verse for cross references': 'ជ្រើសខគម្ពីរសម្រាប់យោងឆ្លង',
    'Open Cross Reference, pick a verse, then click a related verse to open it or Shift+click it to append it.':
        'បើក ខគម្ពីរយោង ជ្រើសខមួយ រួចចុចខដែលពាក់ព័ន្ធដើម្បីបើកវា ឬ shift + click ដើម្បីបន្ថែមចុងក្រោយ។',
    'Filter the people and places lookup': 'ត្រងមនុស្ស និងទីកន្លែងក្នុងគម្ពីរ',
    'Switch Names or Locations, use Search names and Filter by name type, and Jump to page in a long list.':
        'ប្ដូររវាង ឈ្មោះ ឬ ទីកន្លែង ប្រើ ស្វែងរកឈ្មោះ និង ត្រងតាមប្រភេទឈ្មោះ ហើយ ទៅកាន់ទំព័រ ក្នុងបញ្ជីវែង។',
    'Read a place and open its map': 'អានអំពីទីកន្លែង និងបើកផែនទី',
    'Choose Locations in the names lookup, open a place, then use Open in Google Maps if available.':
        'ជ្រើសទីកន្លែងក្នុងការរកឈ្មោះ បើកទីកន្លែងមួយ រួចប្រើបើកក្នុង Google Maps បើមាន។',
    'Find a resource by filename': 'រកធនធានតាមឈ្មោះឯកសារ',
    'In Resources, use Search file name to narrow the files; clear the words when finished.':
        'ក្នុងធនធាន ប្រើស្វែងរកឈ្មោះឯកសារដើម្បីត្រង ហើយសម្អាតពាក្យពេលចប់។',
    'Show resources without chapter names': 'បង្ហាញធនធានដែលគ្មានឈ្មោះជំពូក',
    'Toggle Others in Resources to include files that do not use a book and chapter filename.':
        'ប្ដូរ ផ្សេងៗ ក្នុងធនធាន ដើម្បីបញ្ចូលឯកសារដែលមិនប្រើឈ្មោះសៀវភៅ និងជំពូក។',
    'Refresh or extend the Resources library':
        'ធ្វើបច្ចុប្បន្នភាព ឬបន្ថែមបណ្ណាល័យធនធាន',
    'Use the Resources menu for Add Folder or Reload, and a folder menu for Refresh or Add Files.':
        'ប្រើម៉ឺនុយធនធានសម្រាប់បន្ថែមថត ឬផ្ទុកឡើងវិញ និងម៉ឺនុយថតសម្រាប់ធ្វើឱ្យថ្មី ឬបន្ថែមឯកសារ។',
    'Keep study resources with app data':
        'រក្សាធនធានសិក្សាជាមួយទិន្នន័យកម្មវិធី',
    'Use a resource folder menu > Copy to Data Directory for a portable copy; Remove Folder takes it off the list, files stay.':
        'ប្រើម៉ឺនុយថតឯកសារពាក់ព័ន្ធ > ចម្លងទៅថតទិន្នន័យ សម្រាប់ច្បាប់ចម្លងយកតាមខ្លួន; លុបថតចេញ ដកវាចេញពីបញ្ជី ឯកសារនៅដដែល។',
    'Show one kind of graph relationship': 'បង្ហាញទំនាក់ទំនងក្រាហ្វតែមួយប្រភេទ',
    'In an open graph, toggle relation chips or right-click a chip to show only that relationship.':
        'ក្នុងក្រាហ្វដែលបើក ប្ដូរប៊ូតុងប្រភេទទំនាក់ទំនង ឬចុចស្តាំលើវា ដើម្បីបង្ហាញតែទំនាក់ទំនងនោះ។',
    'Find a connection between Bible records': 'រកទំនាក់ទំនងរវាងទិន្នន័យគម្ពីរ',
    'Open Graph Preview, press Find Connection, choose Path to, then run the search.':
        'បើកមើលក្រាហ្វ ចុចរកទំនាក់ទំនង ជ្រើសផ្លូវទៅ រួចដំណើរការស្វែងរក។',
    'Fit and rearrange a connection graph':
        'សម្រប និងរៀបចំក្រាហ្វទំនាក់ទំនងឡើងវិញ',
    'Use Fit to view, Re-layout, Zoom, Collapse all, Undo, Redo and Fullscreen inside the graph.':
        'ប្រើ ធ្វើឱ្យសមនឹងអេក្រង់ រៀបចំជាថ្មី ពង្រីក បង្រួមទាំងអស់ ត្រឡប់ក្រោយ ធ្វើឡើងវិញ និង ពេញអេក្រង់ ក្នុងក្រាប។',
    'Copy or export a connection graph': 'ចម្លង ឬនាំចេញក្រាហ្វទំនាក់ទំនង',
    'In Graph Preview, use Copy for Markdown or Mermaid text; Presets also offers Save as image and Print.':
        'ក្នុង ក្រាបទំនាក់ទំនង ប្រើ ចម្លង សម្រាប់អត្ថបទ Markdown ឬ Mermaid; គំរូ ក៏មាន រក្សាទុកជារូបភាព និង បោះពុម្ព។',
    'Save and revisit a graph preset': 'រក្សាទុក និងបើកគំរូក្រាហ្វឡើងវិញ',
    'Use Presets > Save preset to name your graph, pick it from Presets later, or Delete preset.':
        'ប្រើ គំរូ > រក្សាទុកគំរូ ដើម្បីដាក់ឈ្មោះក្រាបរបស់អ្នក ជ្រើសវាពី គំរូ ពេលក្រោយ ឬ លុបគំរូ។',
    'Resize or close one Reader panel': 'ប្ដូរទំហំ ឬបិទផ្ទាំងអ្នកអានមួយ',
    'Drag a panel divider, or right-click it for Reset Size, Close First Widget and Close Second Widget.':
        'អូសបន្ទាត់បែងចែកផ្ទាំង ឬចុចស្តាំ ដើម្បីកំណត់ទំហំឡើងវិញ បិទផ្ទាំងទីមួយ ឬបិទផ្ទាំងទីពីរ។',
    'Are you sure you want to clear all settings?':
        'តើអ្នកពិតជាចង់លុបការកំណត់ទាំងអស់ឬ?',
    'Reveal Original': 'បង្ហាញកន្លែងដើម',
    Sort: 'តម្រៀប',
    'Name (A to Z)': 'ឈ្មោះ (A ដល់ Z)',
    'Name (Z to A)': 'ឈ្មោះ (Z ដល់ A)',
    'Type (A to Z)': 'ប្រភេទ (A ដល់ Z)',
    'Type (Z to A)': 'ប្រភេទ (Z ដល់ A)',
    'Zoom In': 'ពង្រីក',
    'Zoom Out': 'បង្រួម',
    Type: 'ប្រភេទ',
    Default: 'លំនាំដើម',
    'All Types': 'គ្រប់ប្រភេទ',
    'Filter by name': 'ត្រងតាមឈ្មោះ',
    'Filter by Type': 'ត្រងតាមប្រភេទ',
    'No matching files': 'រកមិនឃើញឯកសារដែលត្រូវគ្នា',
    'Add Folder': 'បន្ថែមថត',
    'Remove Folder': 'លុបថតចេញ',
    'Folder not found': 'រកមិនឃើញថត',
    'Cannot read folder': 'មិនអាចអានថតបានទេ',
    'Too many folders to search': 'ថតច្រើនពេកមិនអាចស្វែងរកអស់បានទេ',
    'Too many matching files': 'ឯកសារដែលត្រូវគ្នាច្រើនពេក',
    'Search file name': 'ស្វែងរកឈ្មោះឯកសារ',
    'Show files not named after a book and chapter':
        'បង្ហាញឯកសារដែលមិនបានដាក់ឈ្មោះតាមកណ្ឌគម្ពីរ និងជំពូក',
    'Too many other files': 'ឯកសារផ្សេងទៀតច្រើនពេក',
    // --- Resources: the links inside a `.json` beside the verse.
    'Open Link in Browser': 'បើកតំណនៅក្នុងកម្មវិធីរុករក',
    'Too many links': 'តំណច្រើនពេក',
    'entry was not understood': 'ធាតុមិនអាចអានបានទេ',
    'entries were not understood': 'ធាតុមិនអាចអានបានទេ',
    'Only http and https links can be opened':
        'អាចបើកបានតែតំណ http និង https ប៉ុណ្ណោះ',
    'Drop folders here': 'ទម្លាក់ថតនៅទីនេះ',
    'Folder is already added': 'ថតនេះមានក្នុងបញ្ជីរួចហើយ',
    'Drop a folder, not a file': 'សូមទម្លាក់ថត មិនមែនឯកសារទេ',
    // --- Resources: copying a folder into the data directory.
    'Copy to Data Directory': 'ចម្លងទៅថតទិន្នន័យ',
    'Copy this folder, then list the copy here instead?':
        'ចម្លងថតនេះ រួចបង្ហាញថតដែលបានចម្លងនៅទីនេះជំនួសវិញឬ?',
    'Folder is already in the data directory':
        'ថតនេះស្ថិតនៅក្នុងថតទិន្នន័យរួចហើយ',
    'The data directory is inside this folder':
        'ថតទិន្នន័យស្ថិតនៅក្នុងថតនេះ ដូច្នេះមិនអាចចម្លងចូលខ្លួនវាបានទេ',
    'Cannot copy folder': 'មិនអាចចម្លងថតបានទេ',
    'In the data directory': 'នៅក្នុងថតទិន្នន័យ',
    // --- Resources: copying picked files INTO one of the user's folders.
    'Add Files': 'បន្ថែមឯកសារ',
    'file copied': 'ឯកសារត្រូវបានចម្លង',
    'files copied': 'ឯកសារត្រូវបានចម្លង',
    'file was not copied': 'ឯកសារមិនត្រូវបានចម្លងទេ',
    'files were not copied': 'ឯកសារមិនត្រូវបានចម្លងទេ',
    'Cannot copy file': 'មិនអាចចម្លងឯកសារបានទេ',
    'Tick Others to see them': "ធីក 'ផ្សេងទៀត' ដើម្បីមើលពួកវា",
    'They are not shown in this list': 'ពួកវាមិនត្រូវបានបង្ហាញក្នុងបញ្ជីនេះទេ',
    // --- Resources: previewing a markdown file and a bible note file in the
    // app, and the Markdown Preview window.
    'Read-only': 'អានតែប៉ុណ្ណោះ',
    'No notes': 'គ្មានកំណត់ចំណាំ',
    'Not a bible note file': 'មិនមែនជាឯកសារកំណត់ចំណាំព្រះគម្ពីរទេ',
    'This file is too large to preview': 'ឯកសារនេះធំពេក មិនអាចមើលជាមុនបានទេ',
    'Cannot read this file': 'មិនអាចអានឯកសារនេះបានទេ',
    'File not found': 'រកមិនឃើញឯកសារ',
    Back: 'ថយក្រោយ',
    'Open in Default App': 'បើកក្នុងកម្មវិធីលំនាំដើម',
    // --- Bible Find: the results list and its chunk footer.
    'verses found': 'ខគម្ពីរដែលរកឃើញ',
    'verse found': 'ខគម្ពីរដែលរកឃើញ',
    'No verses found': 'រកមិនឃើញខគម្ពីរ',
    Results: 'លទ្ធផល',
    'Go to results': 'ទៅកាន់លទ្ធផល',
    'Load more results': 'ផ្ទុកលទ្ធផលបន្ថែម',
    'Show pages': 'បង្ហាញទំព័រ',
    'Book-level files are shown in every chapter':
        'ឯកសារកម្រិតកណ្ឌគម្ពីរ ត្រូវបានបង្ហាញនៅគ្រប់ជំពូក',
    Introduction: 'សេចក្ដីផ្ដើម',
    '{book} chapter {chapter}': '{book} ជំពូក {chapter}',
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
    'The document data is corrupted and cannot be loaded. A new document is shown instead; the file itself is not changed until you press Save.':
        'ទិន្នន័យឯកសារបាក់បែក និងមិនអាចផ្ទុកបាន។ ឯកសារថ្មីត្រូវបានបង្ហាញជំនួសវិញ ហើយឯកសារដើមមិនត្រូវបានផ្លាស់ប្តូរទេ រហូតដល់អ្នកចុច រក្សាទុក។',
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
    'Unlock the screen to change what it shows':
        'ដោះសោអេក្រង់ ដើម្បីផ្លាស់ប្តូរអ្វីដែលវាបង្ហាញ',
    'Background Images': 'រូបភាពផ្ទៃខាងក្រោយ',
    'Background Videos': 'វីដេអូផ្ទៃខាងក្រោយ',
    'Background Audios': 'សម្លេងផ្ទៃខាងក្រោយ',
    'Background Webs': 'វេបសាយផ្ទៃខាងក្រោយ',
    'Bible Present': 'បង្ហាញព្រះគម្ពីរ',
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
    'The text color was changed so it stays visible on the new background color.':
        'ពណ៌អក្សរត្រូវបានប្ដូរ ដើម្បីឱ្យនៅតែមើលឃើញលើពណ៌ផ្ទៃខាងក្រោយថ្មី។',
    'The file was not found at that address.': 'រកមិនឃើញឯកសារនៅអាសយដ្ឋាននោះទេ។',
    'The server refused the download.': 'ម៉ាស៊ីនមេបានបដិសេធការទាញយក។',
    'Could not reach that address. Check the link and the internet connection.':
        'មិនអាចភ្ជាប់ទៅអាសយដ្ឋាននោះបានទេ។ សូមពិនិត្យតំណភ្ជាប់ និងការតភ្ជាប់អ៊ីនធឺណិត។',
    Display: 'ម៉ូនីទ័រ',
    'Display id': 'លេខសម្គាល់ម៉ូនីទ័រ',
    'Screen id': 'លេខសម្គាល់អេក្រង់',
    primary: 'ចម្បង',
    'Fail to create folder': 'មិនអាចបង្កើតថតបាន',
    'New Note Item': 'បង្កើតកំណត់ត្រាថ្មី',
    'This will select': 'នេះនឹងជ្រើសរើស',
    'will create if not exist': 'នឹងបង្កើតឡើងប្រសិនបើមិនមាន',
    'No directory selected': 'មិនមានថតដែលបានជ្រើស',
    Notes: 'កំណត់ត្រា',
    Note: 'កំណត់ត្រា',
    'Bible Notes': 'កំណត់ត្រាព្រះគម្ពីរ',
    'Bible Notes (Lookup)': 'កំណត់ត្រាព្រះគម្ពីរ (ស្វែងរក)',
    'Bible and Notes': 'ព្រះគម្ពីរ និងកំណត់ត្រា',
    'Bible and Notes (Lookup)': 'ព្រះគម្ពីរ និងកំណត់ត្រា (ស្វែងរក)',
    // Verse marks: highlights and comments made on selected verse text.
    Highlight: 'គូសបន្លិច',
    'Remove Marks': 'លុបសញ្ញាសម្គាល់',
    'No mark in the selected text': 'គ្មានសញ្ញាសម្គាល់ក្នុងអត្ថបទដែលបានជ្រើស',
    'Saving Verse Mark': 'កំពុងរក្សាទុកសញ្ញាសម្គាល់ខគម្ពីរ',
    'Bible notes directory is not set': 'មិនទាន់កំណត់ថតកំណត់ត្រាព្រះគម្ពីរ',
    'Show what is marked on this verse': 'បង្ហាញអ្វីដែលបានសម្គាល់លើខគម្ពីរនេះ',
    'Click to reveal the verse': 'ចុចដើម្បីបង្ហាញខគម្ពីរ',
    'Add Comment': 'បន្ថែមមតិយោបល់',
    'Edit Comment': 'កែមតិយោបល់',
    'Delete Comment': 'លុបមតិយោបល់',
    'Click to edit the comment': 'ចុចដើម្បីកែមតិយោបល់',
    'No comment yet': 'មិនទាន់មានមតិយោបល់',
    'Write a comment': 'សរសេរមតិយោបល់',
    'Add to Bible List': 'បន្ថែមទៅបញ្ជីព្រះគម្ពីរ',
    'Delete Verse Marks': 'លុបសញ្ញាសម្គាល់ខគម្ពីរ',
    'Are you sure to delete all marks on this verse?':
        'តើអ្នកប្រាកដជាចង់លុបសញ្ញាសម្គាល់ទាំងអស់លើខគម្ពីរនេះមែនទេ?',
    'Drag to the Bible list to add this verse':
        'អូសទៅបញ្ជីព្រះគម្ពីរដើម្បីបន្ថែមខគម្ពីរនេះ',
    'Drag to the Bible list, or to another note file':
        'អូសទៅបញ្ជីព្រះគម្ពីរ ឬទៅឯកសារកំណត់ត្រាផ្សេង',
    'Click to open the verse': 'ចុចដើម្បីបើកខគម្ពីរ',
    'Document List': 'បញ្ជីឯកសារ',
    'Lyric List': 'បញ្ជីអក្សរភ្លេង',
    'Presenting Flow List': 'បញ្ជីតារាងកម្មវិធី',
    Previewer: 'កម្មវិធីមើលជាមុន',
    Slides: 'ស្លាយ',
    'Slide Notes': 'កំណត់ត្រាស្លាយ',
    'Slide Document': 'ឯកសារស្លាយ',
    Canvas: 'ផ្ទាំងក្រណាត់',
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
    'Hide Stage': 'លាក់ស្ទែជ',
    'Base Stage': 'ស្ទែជគោល',
    'Base stage is always shown': 'ស្ទែជគោលតែងតែបង្ហាញ',
    'Choose a stage to add': 'ជ្រើសរើសស្ទែជដើម្បីបន្ថែម',
    'Maximum stages are shown': 'បង្ហាញស្ទែជអតិបរមាហើយ',
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
    Resources: 'ឯកសារពាក់ព័ន្ធ',
    'Cross References': 'ខគម្ពីរយោង',
    // --- Cross Reference panel (2026-08-29 redesign).
    Themes: 'ប្រធានបទ',
    'No cross references for this verse': 'គ្មានខគម្ពីរយោងសម្រាប់ខនេះទេ',
    'Open beside the current verse': 'បើកនៅក្បែរខបច្ចុប្បន្ន',
    'No verse selected': 'មិនបានជ្រើសរើសខគម្ពីរទេ',
    'Choose a verse in the reader to see what else in scripture speaks to it.':
        'ជ្រើសរើសខគម្ពីរនៅក្នុងកម្មវិធីអាន ដើម្បីមើលខផ្សេងទៀត' +
        'ក្នុងព្រះគម្ពីរដែលពាក់ព័ន្ធនឹងខនោះ។',
    'Reveal in File Explorer': 'បើកក្នុងកម្មវិធីរុករកឯកសារ',
    'Saving note': 'កំពុងរក្សាទុកកំណត់សម្គាល់',
    'Please wait while the note is being saved.':
        'សូមរង់ចាំ ខណៈដែលកំណត់សម្គាល់កំពុងត្រូវបានរក្សាទុក',
    'Enter your note here': 'បញ្ចូលកំណត់សម្គាល់របស់អ្នកនៅទីនេះ',
    'Slide is copied': 'ស្លាយត្រូវបានចម្លង',
    'Remove Background': 'លុបផ្ទៃខាងក្រោយ',
    'Timezone Hour Offset': 'ការបន្ថែម/បញ្ចូលម៉ោងតំបន់ពេលវេលា',
    'Choose Color': 'ជ្រើសរើសពណ៌',
    'Choose City': 'ជ្រើសរើសទីក្រុង',
    'New Slide': 'ស្លាយថ្មី',
    'Show on Screens': 'បង្ហាញនៅលើអេក្រង់',
    'Toggle showing screen': 'បិទ/បើក ការបង្ហាញអេក្រង់',
    'Reveal Hidden Controls': 'បង្ហាញប៊ូតុងដែលលាក់',
    'Set Specific Screen': 'កំណត់អេក្រង់ជាក់លាក់',
    'Remove from screen': 'ដកចេញពីអេក្រង់',
    Rename: 'កែឈ្មោះ',
    Reload: 'ផ្ទុកឡើងវិញ',
    'Sync group scrolling': 'រំកិលក្រុមស្របគ្នា',
    'Enable group sync scrolling': 'បើកការរំកិលក្រុមស្របគ្នា',
    'Disable group sync scrolling': 'បិទការរំកិលក្រុមស្របគ្នា',
    'Set Line Sync': 'កំណត់ការសម្របសម្រួលបន្ទាត់',
    'Unset Line Sync': 'បោះបង់ការសម្របសម្រួលបន្ទាត់',
    Solo: 'តែមួយ',
    Select: 'ជ្រើសរើស',
    Deselect: 'បោះបង់ជ្រើសរើស',
    'Copy Path to Clipboard': 'ចម្លងផ្លូវទៅកាន់ក្តារចុច',
    'Reveal in Finder': 'បង្ហាញនៅក្នុង Finder',
    'Preview PDF': 'មើល PDF',
    'Refresh PDF Images': 'ផ្ទុករូបភាព PDF ជាថ្មី',
    'Exporting PDF Images': 'កំពុងបម្លែងទំព័រ PDF ទៅជារូបភាព',
    'Please wait while the PDF pages are being exported...':
        'សូមរង់ចាំ ខណៈពេលទំព័រ PDF កំពុងត្រូវបានបម្លែងជារូបភាព...',
    'Preparing PDF pages...': 'កំពុងរៀបចំទំព័រ PDF...',
    'Add New Screen': 'បន្ថែមអេក្រង់ថ្មី',
    'Refresh Preview': 'ផ្ទុកមើលជាមុន',
    'Show Monitor Wallpaper': 'បង្ហាញផ្ទាំងរូបភាពអេក្រង់',
    'The application is started first time':
        'កម្មវិធីត្រូវបានចាប់ផ្តើមជាលើកដំបូង',
    Close: 'បិទ',
    'Toggle Widget Full View': 'បិទ/បើក ទិដ្ឋភាពពេញលេញរបស់ផ្ទាំង',
    Floating: 'ផ្ទាំងអណ្តែត',
    'Split Vertical to': 'បំបែកបញ្ឈរទៅ',
    'Split Horizontal to': 'បំបែកផ្ដេកទៅ',
    'Loading Bible Data': 'កំពុងផ្ទុកទិន្នន័យព្រះគម្ពីរ',
    'Unable to preview right now': 'មិនអាចបង្ហាញបាននៅពេលនេះទេ',
    'Open bible lookup popup': 'បើកផ្ទាំងស្វែងរកព្រះគម្ពីរ',
    Cancel: 'បដិសេធ',
    Ok: 'យល់ព្រម',
    'Choose File': 'ជ្រើសរើសឯកសារ',
    'No file chosen': 'មិនទាន់បានជ្រើសរើសឯកសារ',
    Or: 'ឬ',
    'URL:': 'តំណ៖',
    'Key is already taken': 'កូនសោនេះត្រូវបានប្រើរួចហើយ',
    'File saved at:': 'ឯកសារត្រូវបានរក្សាទុកនៅ៖',
    'Failed to save Bible data': 'បរាជ័យក្នុងការរក្សាទុកទិន្នន័យព្រះគម្ពីរ',
    'Bible XML data not found': 'រកមិនឃើញទិន្នន័យព្រះគម្ពីរ XML',
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
    'Camera Not Available': 'កាមេរ៉ាមិនអាចប្រើបាន',
    'Could not open the camera': 'មិនអាចបើកកាមេរ៉ាបានទេ',
    'A screen cannot show itself': 'អេក្រង់មិនអាចបង្ហាញខ្លួនឯងបានទេ',
    'These screens would show each other':
        'អេក្រង់ទាំងនេះនឹងបង្ហាញគ្នាទៅវិញទៅមក',
    'Start Camera': 'ចាប់ផ្តើមកាមេរ៉ា',
    'Stop Camera': 'បញ្ឈប់កាមេរ៉ា',
    Preview: 'មើលជាមុន',
    Mirror: 'បញ្ច្រាស',
    'Object Fit': 'របៀបដាក់ឲ្យសម',
    Cover: 'គ្របពេញ',
    Contain: 'ដាក់ទាំងមូល',
    Fill: 'ពង្រីកពេញ',
    'Cannot be empty': 'មិនអាចទទេបានទេ',
    'YouTube URL:': 'តំណ YouTube៖',
    'Website URL:': 'តំណគេហទំព័រ៖',
    'Video URL:': 'តំណវីដេអូ៖',
    'Audio URL:': 'តំណសំលេង៖',
    'Image URL:': 'តំណរូបភាព៖',
    'Web URL:': 'តំណវេបសាយ៖',
    'Documents URL:': 'តំណឯកសារ៖',
    'Presenting Flow Archive URL:': 'តំណប័ណ្ណសារតារាងកម្មវិធី៖',
    'Bible Note Archive URL:': 'តំណប័ណ្ណសារកំណត់ចំណាំព្រះគម្ពីរ៖',
    'Open URL': 'បើកតំណ',
    'Copy URL': 'ចម្លងតំណ',
    New: 'ថ្មី',
    'Slides are copied': 'ស្លាយត្រូវបានចម្លង',
    Copied: 'បានចម្លង',
    'Copy failed': 'ការចម្លងបានបរាជ័យ',
    'Could not copy to the clipboard. Try again.':
        'មិនអាចចម្លងទៅក្ដារតម្បៀតខ្ទាស់បានទេ។ សូមព្យាយាមម្ដងទៀត។',
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
    'Show Countdown': 'បង្ហាញការរាប់ថយក្រោយ',
    'Show Stopwatch': 'បង្ហាញនាឡិកាបញ្ឈប់',
    'Auto-start': 'ចាប់ផ្តើមស្វ័យប្រវត្តិ',
    'Start counting as soon as it is shown': 'ចាប់ផ្តើមរាប់ភ្លាមៗពេលបង្ហាញ',
    Start: 'ចាប់ផ្តើម',
    Resume: 'បន្ត',
    'Start counting': 'ចាប់ផ្តើមរាប់',
    'Pause counting': 'ផ្អាកការរាប់',
    'Resume counting': 'បន្តការរាប់',
    'Reset to the full duration': 'កំណត់ឡើងវិញទៅរយៈពេលពេញ',
    'Reset to zero and save the time': 'កំណត់ឡើងវិញទៅសូន្យ ហើយរក្សាទុករយៈពេល',
    History: 'ប្រវត្តិ',
    'Clear stopwatch history': 'សម្អាតប្រវត្តិនាឡិកាបញ្ឈប់',
    'Remove the saved times of this session?':
        'លុបរយៈពេលដែលបានរក្សាទុកនៃវគ្គនេះចេញឬ?',
    Running: 'កំពុងរាប់',
    Paused: 'បានផ្អាក',
    'Not started': 'មិនទាន់ចាប់ផ្តើម',
    Loading: 'កំពុងផ្ទុក',
    'Something Went Wrong': 'មានបញ្ហាកើតឡើង',
    "The app ran into a problem. The assistant can look into it and write a report for you, with this computer's system information and the app's console log in it. Nothing is sent until you say so. Open the assistant to report it?":
        'កម្មវិធីបានជួបបញ្ហា។ ជំនួយការអាចពិនិត្យមើល ហើយសរសេររបាយការណ៍ជូនអ្នក ដោយមានព័ត៌មានប្រព័ន្ធរបស់កុំព្យូទ័រនេះ និងកំណត់ហេតុកុងសូលរបស់កម្មវិធីនៅក្នុងនោះ។ គ្មានអ្វីត្រូវបានផ្ញើទេ រហូតដល់អ្នកយល់ព្រម។ បើកជំនួយការដើម្បីរាយការណ៍បញ្ហានេះ?',
    'Report a Problem': 'រាយការណ៍បញ្ហា',
    'Not Now': 'មិនមែនឥឡូវនេះ',
    'Reload is needed': 'ត្រូវការការផ្ទុកឡើងវិញ',
    'Sorry, an internal process error occurred. Please refresh the app.':
        'យើងខ្ញុំសូមអភ័យទោស កំហុសក្នុងដំណើរការ ខ្ញុំសូមអញ្ជើញអ្នកធ្វើការផ្ទុកឡើងវិញនៃកម្មវិធី',
    Exporting: 'កំពុងបំលែង',
    'Export to MS Word': 'បំលែងទៅឯកសារ MS Word',
    'Export to PPTX': 'បំលែងទៅឯកសារ PPTX',
    'Unable to export the document to PPTX': 'មិនអាចបំលែងឯកសារទៅជា PPTX បានទេ',
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
    // Singular: what ONE attached background is, for the icon that says a
    // slide carries one (`AttachBackgroundIconComp`).
    Image: 'រូបភាព',
    Video: 'វីដេអូ',
    Web: 'វេបសាយ',
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
    'Clear FG Messages': 'លុប FG សារ',
    'Clear FG Marquee Top': 'លុប FG អក្សររត់ខាងលើ',
    'Clear FG Marquee Bottom': 'លុប FG អក្សររត់ខាងក្រោម',
    'Clear FG Quick Text': 'លុប FG អត្ថបទរហ័ស',
    'Clear FG Countdown': 'លុប FG រាប់ថយក្រោយ',
    'Clear FG Stopwatch': 'លុប FG នាឡិកាបញ្ឈប់',
    'Clear FG Time': 'លុប FG ម៉ោង',
    'Clear FG Camera Show': 'លុប FG បង្ហាញកាមេរ៉ា',
    'Clear FG Screen Show': 'លុប FG បង្ហាញអេក្រង់',
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
    'Bibles (Lookup)': 'ព្រះគម្ពីរ (ស្វែងរក)',
    'Full Text': 'បង្ហាញពេញ',
    'Add Extra Bible': 'បន្ថែមព្រះគម្ពីរ',
    'Add Time': 'បន្ថែមម៉ោង',
    'Advance Bible Lookup': 'ស្វែងរកព្រះគម្ពីរកម្រិតខ្ពស់',
    'Advance Lookup': 'ស្វែងរកកម្រិតខ្ពស់',
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
    'Bible key': 'កូនសោរព្រះគម្ពីរ',
    'Bible Lookup': 'ស្វែងរកព្រះគម្ពីរ',
    'Camera Show': 'បង្ហាញកាមេរ៉ា',
    'Screen Show': 'បង្ហាញអេក្រង់',
    'Change Bible Model Info': 'ផ្លាស់ប្តូរព័ត៌មានគំរូព្រះគម្ពីរ',
    'Child Directories': 'ថតកូន',
    'Clear All Settings': 'លុបការកំណត់ទាំងអស់',
    'Clear All': 'លុបទាំងអស់',
    'Clear Background': 'លុបផ្ទៃខាងក្រោយ',
    'Clear Long Text': 'លុបអត្ថបទវែង',
    'Clear Cache': 'លុប Cache',
    'Clear Color Note': 'លុបកំណត់សម្គាល់ពណ៌',
    'Clear Foreground': 'លុបផ្ទៃខាងមុខ',
    // --- Messages ---
    Messages: 'សារ',
    'Show All Messages': 'បង្ហាញសារទាំងអស់',
    'Hide Messages': 'លាក់សារ',
    Message: 'សារ',
    'Add Message': 'បន្ថែមសារ',
    'Type in the empty message first': 'សូមវាយបញ្ចូលក្នុងសារទទេជាមុនសិន',
    'Type a message': 'វាយសារនៅទីនេះ',
    'No message yet': 'មិនទាន់មានសារនៅឡើយ',
    'Show Message': 'បង្ហាញសារ',
    'Hide Message': 'លាក់សារ',
    'Remove Message': 'ដកសារចេញ',
    'Long Text Show': 'ការបង្ហាញអត្ថបទវែង',
    'Show Long Text': 'បង្ហាញអត្ថបទវែង',
    'Hide Long Text': 'លាក់អត្ថបទវែង',
    'Add Language': 'បន្ថែមភាសា',
    'Remove Language': 'ដកភាសាចេញ',
    'Choose Language': 'ជ្រើសរើសភាសា',
    'No language yet': 'មិនទាន់មានភាសានៅឡើយ',
    Source: 'ប្រភព',
    'Raw Text': 'អត្ថបទវាយផ្ទាល់',
    'Lyric File': 'ឯកសារចំរៀង',
    'Choose Lyric': 'ជ្រើសរើសចំរៀង',
    'No lyric file chosen': 'មិនទាន់បានជ្រើសរើសឯកសារចំរៀង',
    'No lyric file in the Documents folder': 'គ្មានឯកសារចំរៀងក្នុងថតឯកសារ',
    'This lyric file could not be read': 'មិនអាចអានឯកសារចំរៀងនេះបានទេ',
    'This lyric file names a part it does not have':
        'ឯកសារចំរៀងនេះហៅផ្នែកដែលវាគ្មាន',
    'The songs do not have the same structure':
        'ចំរៀងទាំងនេះមានរចនាសម្ព័ន្ធមិនដូចគ្នា',
    'Every language needs the same number of sections':
        'គ្រប់ភាសាត្រូវមានចំនួនផ្នែកស្មើគ្នា',
    Section: 'ផ្នែក',
    Sections: 'ផ្នែក',
    'Add Section': 'បន្ថែមផ្នែក',
    'Remove Section': 'ដកផ្នែកចេញ',
    'Type a section': 'វាយផ្នែកនៅទីនេះ',
    'No section yet': 'មិនទាន់មានផ្នែកនៅឡើយ',
    'This section is empty': 'ផ្នែកនេះនៅទទេ',
    'Text Size (%)': 'ទំហំអក្សរ (%)',
    'Bring to Middle': 'នាំមកកណ្តាលអេក្រង់',
    'View as Text Cards': 'មើលជាកាតអត្ថបទ',
    'Remove Time': 'ដកម៉ោងចេញ',
    Rotate: 'ផ្លាស់ប្តូរ',
    'Show each message in turn': 'បង្ហាញសារនីមួយៗតាមវេន',
    'Seconds each message stays before the next':
        'វិនាទីដែលសារនីមួយៗបង្ហាញមុនបន្ទាប់',
    'Tick a screen first, then press the key again':
        'ជ្រើសរើសអេក្រង់ជាមុនសិន រួចចុចគ្រាប់ចុចម្តងទៀត',
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
    'More…': 'ច្រើនទៀត…',
    'Every way to copy the title and text': 'គ្រប់របៀបចម្លងចំណងជើង និងអក្សរ',
    'Title and Text': 'ចំណងជើង និងអក្សរ',
    'Title Only': 'តែចំណងជើង',
    'Text Only': 'តែអក្សរ',
    '(Version) Title': '(កំណែ) ចំណងជើង',
    'Title (Version)': 'ចំណងជើង (កំណែ)',
    'Title without Version': 'ចំណងជើងគ្មានកំណែ',
    '(1): Text': '(១): អក្សរ',
    '1: Text': '១: អក្សរ',
    'Text without Numbers': 'អក្សរគ្មានលេខខ',
    'Generate Slides': 'បង្កើតស្លាយ',
    'Leave empty for Auto. Text shrinks to fit.':
        'ទុកទទេសម្រាប់ទំហំស្វ័យប្រវត្តិ។ អក្សរនឹងរួមតូចដើម្បីឱ្យសមនឹងស្លាយ។',
    'The next verse appears quietly at the bottom right':
        'ខបន្ទាប់បង្ហាញដោយស្រាលនៅជ្រុងខាងក្រោមស្តាំ',
    'Choose Bible versions to include on each slide':
        'ជ្រើសរើសកំណែព្រះគម្ពីរដែលត្រូវដាក់ក្នុងស្លាយនីមួយៗ',
    'A title slide, then one verse per slide with all selected Bible versions':
        'ស្លាយចំណងជើង បន្ទាប់មកមួយខក្នុងមួយស្លាយជាមួយកំណែព្រះគម្ពីរដែលបានជ្រើសរើសទាំងអស់',
    'Bible passage is unavailable in': 'មិនមានខគម្ពីរនេះក្នុង',
    'Unable to generate slides from this Bible item':
        'មិនអាចបង្កើតស្លាយពីខគម្ពីរនេះបានទេ',
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
    'Discard Change': 'បោះបង់ការផ្លាស់ប្តូរ',
    'Drop every unsaved change in this note file?':
        'បោះបង់រាល់ការផ្លាស់ប្តូរដែលមិនទាន់រក្សាទុក ក្នុងឯកសារកំណត់ចំណាំនេះ?',
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
    'Fix slide dimension': 'កែទំហំស្លាយ',
    'Font Family': 'ពុម្ពអក្សរ',
    'Font Weight': 'កម្រាស់ពុម្ពអក្សរ',
    Foreground: 'ផ្ទៃខាងមុខ',
    'Full Width': 'ទទឹងពេញ',
    Full: 'ពេញ',
    'Generated using AI technology.': 'បង្កើតដោយប្រើបច្ចេកវិទ្យា AI',
    'Generated using Google Translate.': 'បង្កើតដោយប្រើ Google Translate',
    // Follows either of the two lines above, on the cross-reference notes.
    'Results may vary and may not be accurate. Please use with caution.':
        'លទ្ធផលអាចប្រែប្រួល ហើយប្រហែលជាមិនត្រឹមត្រូវ។ សូមប្រើដោយប្រុងប្រយ័ត្ន។',
    'Go Back to Presenter': 'ត្រឡប់ទៅកម្មវិធីបង្ហាញ',
    'Go to Bible Setting': 'ទៅកាន់ការកំណត់ព្រះគម្ពីរ',
    'Or add bible ': 'ឬបន្ថែមព្រះគម្ពីរ',
    'Go to Settings': 'ទៅកាន់ការកំណត់',
    'Hide Camera': 'លាក់កាមេរ៉ា',
    'Hide Screen Show': 'លាក់ការបង្ហាញអេក្រង់',
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
    'Mini Screen Options': 'ជម្រើសអេក្រង់តូច',
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
    'Open in Resources': 'បើកនៅក្នុងឯកសារពាក់ព័ន្ធ',
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
    'Pause the audio first, then try again.':
        'សូមផ្អាកសំលេងជាមុនសិន រួចសាកល្បងម្ដងទៀត។',
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
    'Reset to default display dimension': 'កំណត់ទៅវិមាត្របង្ហាញលំនាំដើម',
    'Reset Widgets Size': 'កំណត់ទំហំ Widgets ឡើងវិញ',
    'Are you sure to reset every widget size and reopen the widgets?':
        'តើអ្នកពិតជាចង់កំណត់ទំហំ Widgets ទាំងអស់ឡើងវិញ ' +
        'ហើយបើក Widgets ដែលបានបិទឡើងវិញឬ?',
    Widgets: 'Widgets',
    'Round (%)': 'មូល (%)',
    'Round Size %:': 'ទំហំមូល %:',
    'Round Size Pixel:': 'ទំហំមូល Pixel:',
    'Round Size Pixel': 'ទំហំមូល Pixel',
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
    'Save or discard unsaved Bible changes before resetting.':
        'សូមរក្សាទុក ឬបោះបង់ការផ្លាស់ប្តូរព្រះគម្ពីរដែលមិនទាន់រក្សាទុក ' +
        'មុនពេលកំណត់ឡើងវិញ។',
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
    'Text Color': 'ពណ៌អក្សរ',
    Theme: 'ស្បែក',
    'There is no parent directory selected': 'មិនមានថតមេត្រូវបានជ្រើសរើសទេ',
    'You need to select a parent directory to start using the app.':
        'អ្នកត្រូវជ្រើសរើសថតមេ ដើម្បីចាប់ផ្តើមប្រើកម្មវិធី។',
    'This will change all Slides': 'នេះនឹងផ្លាស់ប្តូរស្លាយទាំងអស់',
    'Time Second Delay:': 'ការពន្យារពេល (វិនាទី):',
    'Time Second to Live:': 'ពេលវាលាផ្សាយផ្ទាល់ (វិនាទី):',
    Time: 'ម៉ោង',
    'Toggle Fading at End': 'បិទ/បើក ការបន្ថយនៅចុងបញ្ចប់',
    'Whether this video fades out as it ends':
        'ថាតើវីដេអូនេះបន្ថយបាត់បន្តិចម្ដងៗនៅពេលចប់ឬទេ',
    Index: 'លេខរៀង',
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
    'Bulk Font': 'ពុម្ពអក្សរសម្រាប់ធាតុច្រើន',
    'Apply to text, Bible and HTML items.':
        'អនុវត្តលើធាតុអត្ថបទ ព្រះគម្ពីរ និង HTML។',
    'Apply to': 'អនុវត្តលើ',
    'All Slides': 'ស្លាយទាំងអស់',
    'Choose slides and items': 'ជ្រើសរើសស្លាយ និងធាតុ',
    'Apply Font Size': 'អនុវត្តទំហំតួអក្សរ',
    'Apply Font Family': 'អនុវត្តពុម្ពអក្សរ',
    'Include locked items': 'រួមបញ្ចូលធាតុដែលបានចាក់សោ',
    'Failed to apply font changes': 'មិនអាចអនុវត្តការផ្លាស់ប្តូរពុម្ពអក្សរ',
    'No items needed updating': 'គ្មានធាតុត្រូវការកែប្រែ',
    'Updated items:': 'ធាតុដែលបានកែប្រែ៖',
    'Keep Open': 'កុំបិទ',
    'Should New Lines': 'គួរតែបង្កើតបន្ទាត់ថ្មី',
    'Break lines following bible info': 'បំបែកបន្ទាត់តាមព័ត៌មានព្រះគម្ពីរ',
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
    'A stage above 0 cuts between slides, so the Slide transition was set to None.':
        'ស្ទែជលើសពី 0 ប្ដូរស្លាយភ្លាមៗ ដូច្នេះការផ្លាស់ប្តូរស្លាយត្រូវបានកំណត់ទៅ គ្មាន។',
    'Background transition': 'ការផ្លាស់ប្តូរផ្ទៃខាងក្រោយ',
    // --- Transition overrides: a slides preview, a slide, a Background tab,
    // one background, a foreground component or one of its sessions can come
    // in with its own transition instead of the screen's.
    'Foreground transition': 'ការផ្លាស់ប្តូរផ្ទៃខាងមុខ',
    'Own transition': 'ការផ្លាស់ប្តូរផ្ទាល់ខ្លួន',
    'Canvas item transition': 'ការផ្លាស់ប្តូរធាតុលើផ្ទាំង',
    'Used when changing slides.': 'ប្រើនៅពេលប្តូរស្លាយ។',
    Follows: 'តាម',
    'Varies by screen': 'ខុសគ្នាតាមអេក្រង់',
    'Screen setting': 'ការកំណត់អេក្រង់',
    'Slides preview': 'ការមើលស្លាយជាមុន',
    'Slides preview transition': 'ការផ្លាស់ប្តូរនៃការមើលស្លាយជាមុន',
    'Every slide of this document comes in with it, unless the slide has its own.':
        'ស្លាយនីមួយៗនៃឯកសារនេះនឹងបង្ហាញមកជាមួយវា លើកលែងតែស្លាយនោះមានការផ្លាស់ប្តូរផ្ទាល់ខ្លួន។',
    'Every background from this tab comes in with it, unless the background has its own.':
        'ផ្ទៃខាងក្រោយនីមួយៗពីផ្ទាំងនេះនឹងបង្ហាញមកជាមួយវា លើកលែងតែផ្ទៃខាងក្រោយនោះមានការផ្លាស់ប្តូរផ្ទាល់ខ្លួន។',
    'Marquee default': 'លំនាំដើមនៃអក្សររត់',
    'All sessions': 'វគ្គទាំងអស់',
    'Transition for all sessions': 'ការផ្លាស់ប្តូរសម្រាប់វគ្គទាំងអស់',
    'Every session of this panel comes in with it, unless the session has its own in Properties.':
        'វគ្គនីមួយៗនៃផ្ទាំងនេះនឹងបង្ហាញមកជាមួយវា លើកលែងតែវគ្គនោះមានការផ្លាស់ប្តូរផ្ទាល់ខ្លួននៅក្នុងលក្ខណសម្បត្តិ។',
    'Clear input': 'លុបទិន្នន័យកំពុងបញ្ចូល',
    'Clear input chunk': 'លុបផ្នែកទិន្នន័យកំពុងបញ្ចូល',
    'Keep popup modal open when adding a bible item, useful in presenter mode':
        'រក្សាទុកផ្ទាំងបង្ហាញពហុមុខងារឱ្យបើកនៅពេលបន្ថែមធាតុព្រះគម្ពីរ មានប្រយោជន៍នៅក្នុងរបៀបកម្មវិធីបង្ហាញ',
    'Canvas Items': 'ធាតុផ្ទាំង',
    'Please change bible key here': 'សូមផ្លាស់ប្តូរកូនសោរព្រះគម្ពីរនៅទីនេះ',
    'Not available': 'មិនមាន',
    'is not available!': 'មិនមានទេ!',
    'Choose a folder': 'ជ្រើសរើសថត',
    'Moving File to Trash': 'កំពុងផ្លាស់ទីឯកសារទៅធុងសំរាម',
    'Are you sure you want to move': 'តើអ្នកពិតជាចង់ផ្លាស់ទី',
    'to trash?': 'ទៅធុងសំរាម?',
    Yes: 'យល់ព្រម',
    No: 'ទេ',
    'will be converted to PDF into': 'នឹងត្រូវបានបម្លែងទៅជា PDF ទៅក្នុង',
    Align: 'តម្រឹម',
    'All Files': 'ឯកសារទាំងអស់',
    'AM/PM': 'ព្រឹក/ល្ងាច',
    AM: 'ព្រឹក',
    PM: 'ល្ងាច',
    'This camera could not be started. Another app may be using it.':
        'មិនអាចបើកកាមេរ៉ានេះបានទេ។ កម្មវិធីផ្សេងប្រហែលជាកំពុងប្រើវា។',
    'Apply this dimension to all slides in this document':
        'អនុវត្តវិមាត្រនេះទៅកាន់ស្លាយទាំងអស់ក្នុងឯកសារនេះ',
    'Are you sure to apply this dimension to all slides?':
        'តើអ្នកពិតជាចង់អនុវត្តវិមាត្រនេះទៅកាន់ស្លាយទាំងអស់ឬ?',
    Auto: 'ស្វ័យប្រវត្តិ',
    'Backdrop Filter': 'តម្រងផ្ទៃខាងក្រោយ',
    Blur: 'ព្រិល',
    'Camera Error': 'កំហុសកាមេរ៉ា',
    City: 'ទីក្រុង',
    Collapse: 'បង្រួម',
    'Corner radius in pixels (0 to use %)':
        'កាំជ្រុងគិតជាភីកសែល (0 ដើម្បីប្រើ %)',
    'Countdown Date': 'កាលបរិច្ឆេទរាប់ថយក្រោយ',
    'Countdown Time': 'ម៉ោងរាប់ថយក្រោយ',
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
    // The whole note FILE, as opposed to the two item keys above.
    'Export Bible Note': 'នាំចេញឯកសារកំណត់ចំណាំព្រះគម្ពីរ',
    'Import Bible Note': 'នាំចូលឯកសារកំណត់ចំណាំព្រះគម្ពីរ',
    // The XML bibles of the Bible settings page, as their own bundle.
    'Bible Data': 'ទិន្នន័យព្រះគម្ពីរ',
    'Export Bible Data': 'នាំចេញទិន្នន័យព្រះគម្ពីរ',
    'Import Bible Data': 'នាំចូលទិន្នន័យព្រះគម្ពីរ',
    'Choose the bibles to export': 'ជ្រើសរើសព្រះគម្ពីរដែលត្រូវនាំចេញ',
    'Choose the bibles to import': 'ជ្រើសរើសព្រះគម្ពីរដែលត្រូវនាំចូល',
    'Drop an exported bible data file here to import':
        'ទម្លាក់ឯកសារទិន្នន័យព្រះគម្ពីរដែលបាននាំចេញនៅទីនេះដើម្បីនាំចូល',
    // Why a row of the import picker is red and cannot be taken. An existing
    // bible is never overwritten and never duplicated beside itself.
    'Bible key already exists': 'លេខកូដព្រះគម្ពីរនេះមានរួចហើយ',
    'Unable to read this bible file': 'មិនអាចអានឯកសារព្រះគម្ពីរនេះបានទេ',
    'Duplicate bible key in this archive':
        'លេខកូដព្រះគម្ពីរស្ទួនក្នុងឯកសារបណ្ណសារនេះ',
    // Export Settings / Import Settings (the Settings window's sidebar), and
    // the sections of its tree (`settingArchiveCatalog.ts`).
    'Export Settings': 'នាំចេញការកំណត់',
    'Import Settings': 'នាំចូលការកំណត់',
    'Export settings to a file': 'នាំចេញការកំណត់ទៅជាឯកសារ',
    'Import settings from a file': 'នាំចូលការកំណត់ពីឯកសារ',
    'Choose the settings to export': 'ជ្រើសរើសការកំណត់ដែលត្រូវនាំចេញ',
    'Choose the settings to import': 'ជ្រើសរើសការកំណត់ដែលត្រូវនាំចូល',
    'Each ticked section replaces the same section on this computer; what the file leaves out goes back to its default':
        'ផ្នែកនីមួយៗដែលបានធីក នឹងជំនួសផ្នែកដដែលនៅលើកុំព្យូទ័រនេះ។ ' +
        'អ្វីដែលឯកសារមិនមាន នឹងត្រឡប់ទៅលំនាំដើមវិញ',
    'Type a password below to include these':
        'វាយពាក្យសម្ងាត់ខាងក្រោម ដើម្បីដាក់បញ្ចូលទាំងនេះ',
    'This computer cannot keep them safely':
        'កុំព្យូទ័រនេះមិនអាចរក្សាទុកវាដោយសុវត្ថិភាពបានទេ',
    'Lets other devices connect to this computer':
        'អនុញ្ញាតឲ្យឧបករណ៍ផ្សេងភ្ជាប់មកកុំព្យូទ័រនេះ',
    'All default': 'លំនាំដើមទាំងអស់',
    'Save or discard unsaved Bible changes before importing settings.':
        'សូមរក្សាទុក ឬបោះបង់ការផ្លាស់ប្តូរព្រះគម្ពីរដែលមិនទាន់រក្សាទុក ' +
        'មុនពេលនាំចូលការកំណត់។',
    Folders: 'ថតឯកសារ',
    'File Color Notes': 'ចំណាំពណ៌ឯកសារ',
    'Reading View': 'ទិដ្ឋភាពអាន',
    'Open Passages': 'បទគម្ពីរដែលកំពុងបើក',
    'Bible on Screen': 'ព្រះគម្ពីរលើអេក្រង់',
    'Screens & Monitors': 'អេក្រង់បង្ហាញ និងម៉ូនីទ័រ',
    Transitions: 'ការផ្លាស់ប្តូរ',
    'Drawing & Spotlight': 'ការគូរ និងពន្លឺបញ្ចាំង',
    'PDF & Pages on Screen': 'PDF និងទំព័រលើអេក្រង់',
    Marquee: 'អក្សររត់',
    'Messages & Quick Text': 'សារ និងអត្ថបទរហ័ស',
    'Timers & Clocks': 'ការរាប់ម៉ោង និងនាឡិកា',
    'Image, Video & Web Shows': 'ការបង្ហាញរូបភាព វីដេអូ និងវេបសាយ',
    'Foreground Panel': 'ផ្ទាំងផ្ទៃខាងមុខ',
    'Background Panel': 'ផ្ទាំងផ្ទៃខាងក្រោយ',
    'Documents & Lyrics': 'ឯកសារ និងអក្សរភ្លេង',
    Editors: 'កម្មវិធីកែសម្រួល',
    Layout: 'ប្លង់',
    'Panel Sizes': 'ទំហំផ្ទាំង',
    'Panel Sizes per Document': 'ទំហំផ្ទាំងតាមឯកសារនីមួយៗ',
    'Windows & Pages': 'បង្អួច និងទំព័រ',
    'AI & Assistant': 'AI និងជំនួយការ',
    Connections: 'ការតភ្ជាប់',
    'Screen Mirror & Virtual Displays': 'ការឆ្លុះអេក្រង់ និងម៉ូនីទ័រនិម្មិត',
    'API Keys & Sign-ins': 'សោ API និងការចូលគណនី',
    'AI Keys': 'សោ AI',
    SongSelect: 'SongSelect',
    'Connection Codes': 'លេខកូដតភ្ជាប់',
    'Other Settings': 'ការកំណត់ផ្សេងទៀត',
    // The two bodies every export/import toast is built from. The path or the
    // name goes on AFTER the translation, never into the key.
    'Exported to': 'បាននាំចេញទៅ',
    Imported: 'បាននាំចូល',
    'Imported {copied} file(s); {reused} already up to date':
        'បាននាំចូលឯកសារ {copied}; {reused} មានរួចហើយ',
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
    // The Presenting Control's snapshot, and the three things it can do with
    // the picture it takes.
    'Take a picture of the app': 'ថតរូបកម្មវិធី',
    'App Snapshot': 'រូបថតកម្មវិធី',
    'Ask the assistant about this': 'សួរជំនួយការអំពីរូបនេះ',
    'Save into your images': 'រក្សាទុកក្នុងរូបភាពរបស់អ្នក',
    'Copied to clipboard': 'បានចម្លងទៅក្តារតម្បៀតខ្ទាស់',
    'Saved into your images': 'បានរក្សាទុកក្នុងរូបភាពរបស់អ្នក',
    'No images folder is set yet': 'មិនទាន់មានថតរូបភាពត្រូវបានកំណត់ទេ',
    'Cannot save this picture': 'មិនអាចរក្សាទុករូបនេះបានទេ',
    'Paste Bible Item': 'បិទភ្ជាប់ធាតុព្រះគម្ពីរ',
    Unlock: 'ដោះសោ',
    Lock: 'ចាក់សោ',
    Left: 'ឆ្វេង',
    Top: 'លើ',
    Width: 'ទទឹង',
    Height: 'កម្ពស់',
    'Horizontal alignment': 'ការតម្រឹមផ្ដេក',
    'Text align left': 'តម្រឹមអក្សរឆ្វេង',
    'Text align top': 'តម្រឹមអក្សរខាងលើ',
    'Text align middle': 'តម្រឹមអក្សរកណ្តាលបញ្ឈរ',
    'Text align bottom': 'តម្រឹមអក្សរខាងក្រោម',
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
    'Full size preview': 'ទិដ្ឋភាពពេញទំហំ',
    'Exit full size preview': 'ចាកចេញពីទិដ្ឋភាពពេញទំហំ',
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
    'Undo Saved Change': 'ត្រឡប់ក្រោយការផ្លាស់ប្តូរឯកសារ',
    'Redo Saved Change': 'ធ្វើឡើងវិញការផ្លាស់ប្តូរឯកសារ',
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
    'Bible Reference': 'ការយោងព្រះគម្ពីរ',
    'Bible Text to Speech': 'ព្រះគម្ពីរបំលែងអក្សរទៅជាសំលេង',
    'Book Chapter': 'ជំពូកគម្ពីរ',
    // A pane title's parts and the pickers they open.
    Book: 'កណ្ឌ',
    Chapter: 'ជំពូក',
    'Verse Start': 'ខចាប់ផ្ដើម',
    'Verse End': 'ខបញ្ចប់',
    'End Chapter': 'ជំពូកបញ្ចប់',
    'Show the next chapter': 'បង្ហាញជំពូកបន្ទាប់',
    'Books map': 'ផែនទីគម្ពីរ',
    'Box Alignment': 'ការតម្រឹមប្រអប់',
    'Box Properties': 'លក្ខណសម្បត្តិប្រអប់',
    'Cannot find Bible Item': 'រកមិនឃើញធាតុព្រះគម្ពីរ',
    'Cannot find Note Item': 'រកមិនឃើញធាតុកំណត់សម្គាល់',
    'Cannot source Bible': 'មិនអាចទាញយកប្រភពព្រះគម្ពីរបានទេ',
    'Cannot source Note': 'មិនអាចទាញយកប្រភពកំណត់សម្គាល់បានទេ',
    'Canvas item not found': 'រកមិនឃើញធាតុផ្ទាំងក្រណាត់',
    'Canvas Scale': 'មាត្រដ្ឋានផ្ទាំងក្រណាត់',
    'Center view': 'ដាក់ទិដ្ឋភាពនៅកណ្តាល',
    'Chapter data not found.': 'រកមិនឃើញទិន្នន័យជំពូក។',
    'Choose Bible Books': 'ជ្រើសរើសគម្ពីរ',
    'Choose Locale': 'ជ្រើសរើសភាសា',
    'Clear url': 'សម្អាត URL',
    'Click to edit this section': 'ចុចដើម្បីកែសម្រួលផ្នែកនេះ',
    'Click to reveal the bible notes of this verse, double click to select verse':
        'ចុចដើម្បីបង្ហាញកំណត់ចំណាំព្រះគម្ពីរនៃខនេះ ចុចពីរដងដើម្បីជ្រើសរើសខ',
    'Color Note': 'ចំណាំពណ៌',
    'Converting to PDF': 'កំពុងបំលែងទៅជា PDF',
    'Copy Color': 'ចម្លងពណ៌',
    'Copy Error Json': 'ចម្លង Json កំហុស',
    'Create New Web File': 'បង្កើតឯកសារវេបថ្មី',
    'Creating Presenting Flow': 'កំពុងបង្កើតតារាងកម្មវិធី',
    'Delete Bible': 'លុបព្រះគម្ពីរ',
    'Delete Bible XML': 'លុប XML ព្រះគម្ពីរ',
    'Are you sure to delete bible XML "{key}"?':
        'តើអ្នកពិតជាចង់លុប XML ព្រះគម្ពីរ "{key}" មែនទេ?',
    'Are you sure to delete bible "{title}"?':
        'តើអ្នកពិតជាចង់លុបព្រះគម្ពីរ "{title}" មែនទេ?',
    'Reset Bible XML': 'កំណត់ XML ព្រះគម្ពីរឡើងវិញ',
    'Reset this bible XML with the app embedded KJV?':
        'កំណត់ XML ព្រះគម្ពីរនេះឡើងវិញដោយ KJV ដែលភ្ជាប់មកជាមួយកម្មវិធី?',
    'All your changes will be lost.':
        'ការផ្លាស់ប្តូរទាំងអស់របស់អ្នកនឹងត្រូវបាត់បង់។',
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
    'Try Next Chapter': 'សាកល្បងជំពូកបន្ទាប់',
    'Try Previous Chapter': 'សាកល្បងជំពូកមុន',
    'Unable to find next chapter': 'រកមិនឃើញជំពូកបន្ទាប់',
    'Unable to find previous chapter': 'រកមិនឃើញជំពូកមុន',
    'Leave a markdown text here': 'សរសេរអក្សរ markdown នៅទីនេះ',
    'Leave a marquee bottom text here': 'សរសេរអត្ថបទអក្សររត់ខាងក្រោមនៅទីនេះ',
    'Leave a marquee top text here': 'សរសេរអត្ថបទអក្សររត់ខាងលើនៅទីនេះ',
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
    'Toggle Bible Audio': 'បិទ ឬបើកសំលេងព្រះគម្ពីរ',
    'Please open a folder first': 'សូមបើកថតជាមុនសិន',
    'Please select an Open Worship slide first':
        'សូមជ្រើសរើសស្លាយ Open Worship ជាមុនសិន',
    'Position & Size': 'ទីតាំង និងទំហំ',
    'PowerPoint Document': 'ឯកសារ PowerPoint',
    'Preview Size Scale': 'មាត្រដ្ឋានទំហំមើលជាមុន',
    'Stop rendering preview': 'ឈប់បង្ហាញការមើលជាមុន',
    'Resume rendering preview': 'បន្តបង្ហាញការមើលជាមុន',
    'No rendering': 'មិនបង្ហាញ',
    Previous: 'មុន',
    'Reset Date and Time to Now': 'កំណត់កាលបរិច្ឆេទ និងម៉ោងទៅពេលឥឡូវនេះ',
    'That date and time has already passed':
        'កាលបរិច្ឆេទ និងម៉ោងនោះបានកន្លងផុតទៅហើយ',
    'Pick a date and time later than now, or press Reset.':
        'សូមជ្រើសរើសកាលបរិច្ឆេទ និងម៉ោងក្រោយពេលឥឡូវនេះ ឬចុច កំណត់ឡើងវិញ។',
    'Rotate:': 'បង្វិល៖',
    'Saving Bible Data': 'កំពុងរក្សាទុកទិន្នន័យព្រះគម្ពីរ',
    'Saving File': 'កំពុងរក្សាទុកឯកសារ',
    'Scroll to the top': 'រំកិលទៅលើគេ',
    'Click or Double Click to scroll to the top':
        'ចុច ឬចុចពីរដង ដើម្បីរំកិលទៅលើគេ',
    'Click to scroll to the bottom, double click to speed up, right click to slow down, Alt + right click to stop':
        'ចុចដើម្បីរំកិលទៅបាត ចុចពីរដងដើម្បីបង្កើនល្បឿន ចុចខាងស្ដាំដើម្បីបន្ថយល្បឿន Alt + ចុចខាងស្ដាំដើម្បីបញ្ឈប់',
    'Auto Scroll Options': 'ជម្រើសរំកិលដោយស្វ័យប្រវត្តិ',
    'Auto Scroll Speed': 'ល្បឿនរំកិលដោយស្វ័យប្រវត្តិ',
    'Speed Up': 'បង្កើនល្បឿន',
    'Speed Up Faster': 'បង្កើនល្បឿនខ្លាំង',
    'Slow Down': 'បន្ថយល្បឿន',
    'Stop Auto Scrolling': 'បញ្ឈប់ការរំកិលដោយស្វ័យប្រវត្តិ',
    Click: 'ចុច',
    'Double Click': 'ចុចពីរដង',
    'Right Click': 'ចុចខាងស្តាំ',
    'Alt + Right Click': 'Alt + ចុចខាងស្តាំ',
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
    'Text has been copied to clipboard':
        'អក្សរត្រូវបានចម្លងទៅក្ដារតម្បៀតខ្ទាស់',
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
    // The language the lookup DATASET is read in, which is a separate
    // choice from the language of the interface.
    'Names and locations language': 'ភាសាឈ្មោះ និងទីកន្លែង',
    // Tooltip of that language code while it is red: the bible being read is
    // in another language.
    'Not the language of the Bible': 'មិនមែនជាភាសារបស់ព្រះគម្ពីរ',
    Names: 'ឈ្មោះ',
    Locations: 'ទីកន្លែង',
    'Search names': 'ស្វែងរកឈ្មោះ',
    'Search locations': 'ស្វែងរកទីកន្លែង',
    'Search verses': 'ស្វែងរកខគម្ពីរ',
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
    // The same nine types named ONE at a time, for a single record's `Type` row
    // and its fact chip. `Life`, `Supernatural` and `Unknown` read the same
    // either way and are not repeated — a duplicate key throws on module load.
    Concept: 'គំនិត',
    Deity: 'ព្រះ',
    Group: 'ក្រុម',
    Month: 'ខែ',
    Person: 'មនុស្ស',
    Place: 'ទីកន្លែង',
    // A name's `gender` and a location's `type`: both kept in English by every
    // dataset (`GENDER_LABEL`, `LOCATION_TYPE_LABEL`). `City` and `Place`
    // already exist and are not repeated — a duplicate throws on module load.
    Male: 'ប្រុស',
    Female: 'ស្រី',
    Battlefield: 'សមរភូមិ',
    Camp: 'ជំរំ',
    Cape: 'ជ្រោយ',
    Cliff: 'ច្រាំងថ្មចោទ',
    Encampment: 'ទីតាំងបោះជំរំ',
    Gate: 'ទ្វារក្រុង',
    Heights: 'ទីទួលខ្ពស់',
    Island: 'កោះ',
    Landmark: 'ទីសម្គាល់',
    'Memorial place': 'ទីរំលឹក',
    Mountain: 'ភ្នំ',
    Plain: 'វាលទំនាប',
    Pool: 'ស្រះ',
    Region: 'តំបន់',
    River: 'ទន្លេ',
    Road: 'ផ្លូវ',
    Sea: 'សមុទ្រ',
    Settlement: 'ភូមិ',
    Site: 'ទីតាំង',
    Spring: 'ប្រភពទឹក',
    Street: 'វិថី',
    Stronghold: 'បន្ទាយ',
    Territory: 'ទឹកដី',
    Tower: 'ប៉ម',
    Town: 'ទីប្រជុំជន',
    Valley: 'ជ្រលងភ្នំ',
    'Body of water': 'ផ្ទៃទឹក',
    Well: 'អណ្ដូង',
    Wilderness: 'ទីរហោស្ថាន',
    // A name's `age` and its year ranges, also English in every dataset
    // (`AGE_PATTERN_LIST`, `YEAR_RANGE_TYPE_LABEL`). `{count}` and `{year}` are
    // put back in by the caller.
    '{count} years': '{count} ឆ្នាំ',
    '{count} at accession': 'ឡើងគ្រងរាជ្យនៅអាយុ {count} ឆ្នាំ',
    'about {count} at start of ministry':
        'ប្រហែល {count} ឆ្នាំ នៅពេលចាប់ផ្ដើមព័ន្ធកិច្ច',
    Reign: 'រជ្ជកាល',
    Coregency: 'សហរជ្ជកាល',
    '{year} BC': '{year} មុនគ.ស.',
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
    Verse: 'ខគម្ពីរ',
    Verses: 'ខគម្ពីរ',
    Links: 'តំណភ្ជាប់',
    'Modern identification': 'ការកំណត់អត្តសញ្ញាណសម័យទំនើប',
    'Related locations': 'ទីកន្លែងពាក់ព័ន្ធ',
    Coordinates: 'កូអរដោនេ',
    'Approximate location, the marker is an estimated point':
        'ទីតាំងប្រហាក់ប្រហែល សញ្ញាសម្គាល់ជាចំណុចប៉ាន់ស្មាន',
    'Open in Google Maps': 'បើកក្នុង Google Maps',
    'Open in bible lookup': 'បើកក្នុងការស្វែងរកព្រះគម្ពីរ',
    // A verse detail panel's `(KJV)`: opens the verse in a panel of its own
    // in another installed bible.
    'Open in another Bible': 'បើកក្នុងព្រះគម្ពីរផ្សេងទៀត',
    'Show more': 'បង្ហាញបន្ថែម',
    // The bible translation info popup, opened from the lookup pane header while
    // no verse has resolved yet. `Title` already exists above and resolves after
    // key sanitization, so it is not repeated here — a duplicate would throw
    // when this module loads.
    'Bible Information': 'ព័ត៌មានព្រះគម្ពីរ',
    Key: 'កូនសោ',
    Version: 'កំណែ',
    Locale: 'ភាសា',
    Publisher: 'អ្នកបោះពុម្ពផ្សាយ',
    'Copy Rights': 'រក្សាសិទ្ធិ',
    'Legal Note': 'កំណត់សម្គាល់ផ្លូវច្បាប់',
    Description: 'ការពិពណ៌នា',
    Books: 'គម្ពីរ',
    // --- The on-demand media tools pack (Settings > Others > Extra Binaries),
    // and the dialog that sends a user there when they try to download a video
    // or audio without it (2026-08-10).
    // --- Settings > Others, reworked into three service rows (2026-08-24).
    // The state pill of each row speaks that service's own vocabulary rather
    // than one shared word, so the label matches the button that changes it.
    'AI Providers': 'អ្នកផ្តល់សេវា AI',
    'Add a key from either provider to use custom Bible Cross Ref and Bible Audio.':
        'បញ្ចូល key ពីអ្នកផ្តល់សេវាណាមួយ ដើម្បីប្រើ Bible Cross Ref ' +
        'និង Bible Audio តាមបំណង។',
    'Key set': 'មាន key ហើយ',
    'No key set': 'មិនទាន់មាន key',
    // --- Kimi joins the chatbot, and every AI row now says what its key is
    // actually FOR (2026-09-01). The two hints it replaces both named Bible
    // Cross Ref and Bible Audio and forgot the chatbot, which they also drive.
    Kimi: 'កីមី',
    'Kimi API Key': 'Kimi API Key',
    'Create Kimi api key': 'បង្កើត Kimi api key',
    'Answers in the chatbot only': 'ឆ្លើយតែក្នុង chatbot ប៉ុណ្ណោះ',
    'Answers in the chatbot, and powers custom Bible Cross Reference':
        'ឆ្លើយក្នុង chatbot និងបន្ទេមឆ្លើយ Bible Cross Reference តាមបំណង',
    'Answers in the chatbot, and powers custom Bible Cross Reference and Bible Audio':
        'ឆ្លើយក្នុង chatbot និងបន្ទេមឆ្លើយ Bible Cross Reference និង Bible Audio តាមបំណង',
    'Used by': 'ប្រើដោយ',
    Chatbot: 'Chatbot',
    'Bible Audio': 'សំលេងព្រះគម្ពីរ',
    'Add a key from any one of these. Each row says what its key is used for.':
        'បញ្ចូល key ពីមួយក្នុងចំណោមនេះ។ ជួរនីមួយៗ បង្ហាញនូវការប្រើប្រាស់ key របស់វា។',
    'Fail to get Kimi instance': 'មិនអាចយក Kimi instance បាន',
    'Missing Kimi API Key.': 'ខ្វះ Kimi API Key។',
    // --- Amazon Bedrock joins the chatbot (2026-10-09), Gemma 4 31B first.
    'Amazon Bedrock': 'Amazon Bedrock',
    'Amazon Bedrock API Key': 'Amazon Bedrock API Key',
    'Create Amazon Bedrock api key': 'បង្កើត Amazon Bedrock api key',
    'Fail to get Amazon Bedrock instance':
        'មិនអាចយក Amazon Bedrock instance បាន',
    'Missing Amazon Bedrock API Key.': 'ខ្វះ Amazon Bedrock API Key។',
    'AWS Region': 'តំបន់ AWS',
    'The region your Bedrock models are enabled in':
        'តំបន់ដែលម៉ូដែល Bedrock របស់អ្នកត្រូវបានបើក',
    // --- The user's own model servers (LM Studio, Ollama, ...) (2026-10-09).
    'Custom servers': 'ម៉ាស៊ីនមេផ្ទាល់ខ្លួន',
    'Your own AI server, such as LM Studio or Ollama on this computer, or any service that speaks the OpenAI API. Each server shows in the chatbot as its own assistant.':
        'ម៉ាស៊ីនមេ AI ផ្ទាល់ខ្លួនរបស់អ្នក ដូចជា LM Studio ឬ Ollama នៅលើកុំព្យូទ័រនេះ ឬសេវាណាមួយដែលប្រើ OpenAI API។ ម៉ាស៊ីនមេនីមួយៗបង្ហាញក្នុង chatbot ជាជំនួយការមួយដាច់ដោយឡែក។',
    'Add server': 'បន្ថែមម៉ាស៊ីនមេ',
    // --- The servers the project's site shares, listed read-only (2026-10-10).
    'Shared servers': 'ម៉ាស៊ីនមេដែលបានចែករំលែក',
    'Servers that openworship.app shares with every copy of the app. They are read-only here, and each one shows in the chatbot as its own assistant.':
        'ម៉ាស៊ីនមេដែល openworship.app ចែករំលែកជាមួយកម្មវិធីនេះគ្រប់ច្បាប់ចម្លង។ នៅទីនេះអានតែប៉ុណ្ណោះ ហើយម៉ាស៊ីនមេនីមួយៗបង្ហាញក្នុង chatbot ជាជំនួយការមួយដាច់ដោយឡែក។',
    'Reload the shared servers': 'ផ្ទុកម៉ាស៊ីនមេដែលបានចែករំលែកឡើងវិញ',
    'The last read failed:': 'ការអានចុងក្រោយបរាជ័យ៖',
    'Last read at': 'អានចុងក្រោយនៅម៉ោង',
    'No server is shared right now.':
        'ពេលនេះគ្មានម៉ាស៊ីនមេណាត្រូវបានចែករំលែកទេ។',
    'Shared by openworship.app. It cannot be changed here.':
        'ចែករំលែកដោយ openworship.app។ មិនអាចផ្លាស់ប្តូរវានៅទីនេះបានទេ។',
    'New server': 'ម៉ាស៊ីនមេថ្មី',
    'Delete this server': 'លុបម៉ាស៊ីនមេនេះ',
    'Server name': 'ឈ្មោះម៉ាស៊ីនមេ',
    'The name the chatbot shows for this server, such as LM Studio':
        'ឈ្មោះដែល chatbot បង្ហាញសម្រាប់ម៉ាស៊ីនមេនេះ ដូចជា LM Studio',
    'Base URL': 'URL មូលដ្ឋាន',
    'The address that ends in /v1, such as http://localhost:1234/v1 for LM Studio or http://localhost:11434/v1 for Ollama':
        'អាសយដ្ឋានដែលបញ្ចប់ដោយ /v1 ដូចជា http://localhost:1234/v1 សម្រាប់ LM Studio ឬ http://localhost:11434/v1 សម្រាប់ Ollama',
    'Address corrected to': 'អាសយដ្ឋានត្រូវបានកែទៅជា',
    'API key (optional)': 'API key (ស្រេចចិត្ត)',
    'Only if the server asks for one. It is stored encrypted and never shown to the chatbot window.':
        'តែក្នុងករណីម៉ាស៊ីនមេសុំវាប៉ុណ្ណោះ។ វាត្រូវបានរក្សាទុកដោយអ៊ិនគ្រីប ហើយមិនដែលបង្ហាញទៅផ្ទាំង chatbot ទេ។',
    Test: 'សាកល្បង',
    'Load models from server': 'ផ្ទុកម៉ូដែលពីម៉ាស៊ីនមេ',
    'Asking the server…': 'កំពុងសួរម៉ាស៊ីនមេ…',
    'The server answered. Chat models it has:':
        'ម៉ាស៊ីនមេបានឆ្លើយ។ ម៉ូដែលជជែកដែលវាមាន៖',
    'The server did not answer:': 'ម៉ាស៊ីនមេមិនបានឆ្លើយ៖',
    'Models loaded from the server:': 'ម៉ូដែលដែលបានផ្ទុកពីម៉ាស៊ីនមេ៖',
    'This is not a web address yet. It should look like http://localhost:1234/v1':
        'នេះមិនទាន់ជាអាសយដ្ឋានវេបទេ។ វាគួរតែមានរាងដូច http://localhost:1234/v1',
    'Offered in the chatbot': 'មានក្នុង chatbot',
    'Give it a name, an address and at least one model to offer it in the chatbot.':
        'ដាក់ឈ្មោះ អាសយដ្ឋាន និងម៉ូដែលយ៉ាងតិចមួយ ដើម្បីឱ្យវាមានក្នុង chatbot។',
    Models: 'ម៉ូដែល',
    'Add model': 'បន្ថែមម៉ូដែល',
    'Model id': 'លេខសម្គាល់ម៉ូដែល',
    'Model id, as the server names it':
        'លេខសម្គាល់ម៉ូដែល ដូចដែលម៉ាស៊ីនមេដាក់ឈ្មោះ',
    'Model name': 'ឈ្មោះម៉ូដែល',
    'Name shown in the chatbot (optional)':
        'ឈ្មោះដែលបង្ហាញក្នុង chatbot (ស្រេចចិត្ត)',
    'Remove this model': 'ដកម៉ូដែលនេះចេញ',
    'Sees pictures': 'មើលរូបភាពបាន',
    'Tick only if this model can look at a picture. Load models from server ticks it for you on LM Studio and Ollama.':
        'គូសធីកតែពេលម៉ូដែលនេះអាចមើលរូបភាពបាន។ នៅលើ LM Studio និង Ollama ប៊ូតុង «ផ្ទុកម៉ូដែលពីម៉ាស៊ីនមេ» គូសវាឱ្យអ្នកដោយស្វ័យប្រវត្តិ។',
    'Not loaded in LM Studio right now. The first question waits for it to load.':
        'មិនទាន់បានផ្ទុកក្នុង LM Studio ទេពេលនេះ។ សំណួរដំបូងនឹងរង់ចាំវាផ្ទុក។',
    'Loaded in LM Studio. Context length:':
        'បានផ្ទុកក្នុង LM Studio។ ប្រវែងបរិបទ (Context Length)៖',
    'In LM Studio, load this model again with a Context Length of':
        'ក្នុង LM Studio សូមផ្ទុកម៉ូដែលនេះម្ដងទៀតដោយ Context Length',
    // The same three for Ollama (2026-10-10), whose app has one context
    // length setting for every model rather than a load dialog per model.
    'Not loaded in llama.cpp right now. The first question waits for it to load.':
        'មិនទាន់បានផ្ទុកក្នុង llama.cpp ឥឡូវនេះទេ។ សំណួរដំបូងរង់ចាំវាផ្ទុក។',
    'Not loaded in Ollama right now. The first question waits for it to load.':
        'មិនទាន់បានផ្ទុកក្នុង Ollama ទេពេលនេះ។ សំណួរដំបូងនឹងរង់ចាំវាផ្ទុក។',
    'Loaded in Ollama. Context length:':
        'បានផ្ទុកក្នុង Ollama។ ប្រវែងបរិបទ (Context Length)៖',
    'In the Ollama app, set Settings → Context length to':
        'ក្នុងកម្មវិធី Ollama សូមកំណត់ Settings → Context length ទៅ',
    // And llama.cpp's own server (llamafile too), which runs one model with
    // the context it was started with.
    'Loaded in llama.cpp. Context length:':
        'បានផ្ទុកក្នុង llama.cpp។ ប្រវែងបរិបទ (Context Length)៖',
    'Start llama-server again with a context size (-c) of':
        'សូមចាប់ផ្ដើម llama-server ម្ដងទៀតដោយទំហំបរិបទ (-c)',
    // The door for somebody who has none of these yet (2026-10-10, the
    // user's ask): a page of videos on setting LM Studio up.
    'Watch how to set up a free AI assistant on your own computer':
        'មើលរបៀបដំឡើងជំនួយការ AI ឥតគិតថ្លៃនៅលើកុំព្យូទ័ររបស់អ្នកផ្ទាល់',
    'LM Studio videos': 'វីដេអូ LM Studio',
    'Ollama videos': 'វីដេអូ Ollama',
    'Opens YouTube videos about LM Studio in your browser':
        'បើកវីដេអូ YouTube អំពី LM Studio ក្នុងកម្មវិធីរុករករបស់អ្នក',
    'Opens YouTube videos about Ollama in your browser':
        'បើកវីដេអូ YouTube អំពី Ollama ក្នុងកម្មវិធីរុករករបស់អ្នក',
    'That is too small for the assistant.': 'វាតូចពេកសម្រាប់ជំនួយការ។',
    'A follow-up question may not fit.': 'សំណួរបន្តអាចនឹងមិនសមល្មម។',
    'working on an answer': 'កំពុងរៀបចំចម្លើយ',
    // --- The keyless assistant, for a user who has typed no key at all
    // (2026-09-01). It answers over free PUBLIC services, so the panel says so.
    'Fail to get free assistant': 'មិនអាចយកជំនួយការឥតគិតថ្លៃបាន',
    'Free assistant (no key needed)': 'ជំនួយការឥតគិតថ្លៃ (មិនត្រូវការ key)',
    'With no key of your own, the chatbot answers through free public AI services. They are shared, slower, and can be busy, and your questions leave this computer. Add a key above for better and more private answers.':
        'ប្រសិនបើអ្នកមិនមាន key ផ្ទាល់ខ្លួន chatbot ឆ្លើយតាមរយៈសេវាកម្ម AI សាធារណៈឥតគិតថ្លៃ។ សេវាទាំងនោះត្រូវបានចែករំលែក យឺត និងអាចរវល់ ហើយសំណួររបស់អ្នកនឹងចាកចេញពីកុំព្យូទ័រនេះ។ សូមបញ្ចូល key ខាងលើ ដើម្បីទទួលចម្លើយប្រសើរ និងឯកជនជាងមុន។',
    // --- The AI master switch and the in-app chatbot (2026-08-31).
    'Enable AI features': 'បើកមុខងារ AI',
    'Turns off the chatbot, the assistant tools and the debugging endpoint they use.':
        'បិទ chatbot ឧបករណ៍ជំនួយការ និង debugging endpoint ដែលវាប្រើ។',
    'Restart the app to apply': 'សូមបើកកម្មវិធីឡើងវិញ ដើម្បីអនុវត្ត',
    'Restart Now': 'បើកឡើងវិញឥឡូវនេះ',
    'The app will close and open again. Save your work first.':
        'កម្មវិធីនឹងបិទ ហើយបើកឡើងវិញ។ សូមរក្សាទុកការងាររបស់អ្នកជាមុនសិន។',
    'Turned off': 'បានបិទ',
    'AI features are turned off in Settings.':
        'មុខងារ AI ត្រូវបានបិទនៅក្នុងការកំណត់។',
    'Would you like to open Settings to enable them?':
        'តើអ្នកចង់បើកការកំណត់ ដើម្បីបើកវាឬ?',
    'Only needed if your Anthropic key is identity-linked':
        'ត្រូវការតែពេល key Anthropic របស់អ្នកជាប្រភេទ identity-linked ប៉ុណ្ណោះ',
    'App Assistant': 'ជំនួយការកម្មវិធី',
    'AI Chat': 'ជជែក AI',
    // --- The Help button's two answers, and Help -> Open Online Help
    // (2026-10-12).
    'Open Online Help': 'បើកជំនួយតាមអ៊ីនធឺណិត',
    'Open Chatbot': 'បើក Chatbot',
    // --- The stay-awake switch in the Presenter's and the Screen Mirror
    // page's header (2026-10-09). The two sentences follow the name on the
    // hover, after a dash, so they start in lower case.
    'Stay Awake': 'រក្សាឲ្យភ្ញាក់',
    'this computer will not sleep while this page is open':
        'កុំព្យូទ័រនេះនឹងមិនដេកទេ ពេលទំព័រនេះកំពុងបើក',
    'turned off, this computer may sleep when no screen is showing':
        'បានបិទ កុំព្យូទ័រនេះអាចដេកបាន ពេលគ្មានអេក្រង់ណាកំពុងបង្ហាញ',
    // --- The caution asked before either AI window opens (2026-09-12).
    'Be careful with AI': 'សូមប្រុងប្រយ័ត្នជាមួយ AI',
    'Do not show this again for 30 days':
        'កុំបង្ហាញសារនេះម្តងទៀតក្នុងរយៈពេល ៣០ ថ្ងៃ',
    'AI can be confidently wrong.':
        'AI អាចឆ្លើយខុស ទាំងដែលមើលទៅដូចជាត្រឹមត្រូវ។',
    'It can misread the app or describe a button that is not there, and what it offers to do can reach a live projector. Check anything that matters before a service, and read a step yourself before you press it.':
        'វាអាចអានកម្មវិធីនេះខុស ឬពណ៌នាប៊ូតុងដែលគ្មានពិត ហើយអ្វីដែលវាស្នើធ្វើ អាចប៉ះពាល់ដល់ការបញ្ចាំងផ្ទាល់។ សូមពិនិត្យរាល់អ្វីដែលសំខាន់មុនពេលថ្វាយបង្គំ ហើយអានជំហាននីមួយៗដោយខ្លួនឯងមុនពេលចុច។',
    "This opens a company's own chat website: whatever you type there leaves this computer, and it knows nothing about this app. Check anything that matters before a service.":
        'វាបើកគេហទំព័រជជែករបស់ក្រុមហ៊ុនផ្ទាល់៖ អ្វីដែលអ្នកវាយបញ្ចូលនឹងចាកចេញពីកុំព្យូទ័រនេះ ហើយវាមិនដឹងអ្វីអំពីកម្មវិធីនេះទេ។ សូមពិនិត្យរាល់អ្វីដែលសំខាន់មុនពេលថ្វាយបង្គំ។',
    'Get key': 'យក key',
    'Get ID': 'យក ID',
    'Find Anthropic workspace id': 'រកមើល Anthropic workspace id',
    Hide: 'លាក់',
    'Extra Binaries': 'កម្មវិធីបន្ថែម',
    'The media tools used to download background video and audio, and the Screen Mirror internet tunnel. They are downloaded separately to keep the app small.':
        'ឧបករណ៍មេឌាសម្រាប់ទាញយកវីដេអូ និងសំឡេងផ្ទៃខាងក្រោយ និងផ្លូវរូងអ៊ីនធឺណិតនៃការឆ្លុះអេក្រង់។ ' +
        'វាត្រូវបានទាញយកដោយឡែក ដើម្បីឲ្យកម្មវិធីនៅតូច។',
    'Media Tools Required': 'ត្រូវការឧបករណ៍មេឌា',
    'Downloading video or audio needs the extra binaries, which are not installed yet.':
        'ការទាញយកវីដេអូ ឬសំឡេង ត្រូវការកម្មវិធីបន្ថែម ' +
        'ដែលមិនទាន់បានដំឡើងនៅឡើយ។',
    'Would you like to open Settings to install them?':
        'តើអ្នកចង់បើកការកំណត់ ដើម្បីដំឡើងវាឬ?',
    Location: 'ទីតាំង',
    'Installed version': 'កំណែដែលបានដំឡើង',
    'Latest version': 'កំណែថ្មីបំផុត',
    'Not installed': 'មិនទាន់បានដំឡើង',
    Installed: 'បានដំឡើង',
    'Checking...': 'កំពុងពិនិត្យ...',
    'Could not check for updates': 'មិនអាចពិនិត្យរកកំណែថ្មីបានទេ',
    Archive: 'ឯកសារបង្ហាប់',
    'Kept on purpose, so the binaries can be extracted again without downloading.':
        'ត្រូវបានរក្សាទុកដោយចេតនា ដើម្បីអាចពន្លាកម្មវិធីឡើងវិញ ' +
        'ដោយមិនចាំបាច់ទាញយកម្តងទៀត។',
    'Download and Install': 'ទាញយក និងដំឡើង',
    'Update to': 'ធ្វើបច្ចុប្បន្នភាពទៅ',
    Reinstall: 'ដំឡើងឡើងវិញ',
    'Re-extract': 'ពន្លាឡើងវិញ',
    'Reveal Folder': 'បង្ហាញថតឯកសារ',
    'No pack is available for this app version':
        'គ្មានកញ្ចប់សម្រាប់កំណែកម្មវិធីនេះទេ',
    'No local pack was built yet': 'មិនទាន់បានបង្កើតកញ្ចប់ក្នុងម៉ាស៊ីននេះទេ',
    'The media tools may be out of date': 'ឧបករណ៍មេឌាអាចហួសសម័យហើយ',
    'Press Enter to apply this folder': 'ចុច Enter ដើម្បីអនុវត្តថតនេះ',
    'Something went wrong here': 'មានបញ្ហាកើតឡើងនៅទីនេះ',
    'Try Again': 'ព្យាយាមម្តងទៀត',
    // Shown in both credential cards of Settings > Others when the OS has no
    // usable credential store, so nothing can be encrypted at rest (2026-08-24).
    'This system has no secure credential store, so keys are kept only until the app closes':
        'ប្រព័ន្ធនេះគ្មានកន្លែងរក្សាទុកព័ត៌មានសម្ងាត់ដោយសុវត្ថិភាពទេ ' +
        'ដូច្នេះកូនសោនឹងត្រូវរក្សាទុករហូតដល់ពេលបិទកម្មវិធីប៉ុណ្ណោះ',
    // --- CCLI SongSelect integration: the Settings > Others credential
    // section with its OAuth sign-in, the documents list's "Import From
    // SongSelect" item, and the search/download popup (2026-08-24).
    'SongSelect Integration': 'ការភ្ជាប់ SongSelect',
    'Import song lyrics from CCLI SongSelect':
        'នាំចូលអត្ថបទចម្រៀងពី CCLI SongSelect',
    'The OAuth client ID of your CCLI API application':
        'OAuth client ID នៃកម្មវិធី CCLI API របស់អ្នក',
    'Leave empty for a public client': 'ទុកឲ្យទទេ សម្រាប់ public client',
    'The subscription key from the CCLI developer portal':
        'Subscription key ពី CCLI developer portal',
    'Must exactly match the redirect URI registered with CCLI':
        'ត្រូវតែដូចគ្នានឹង redirect URI ដែលបានចុះឈ្មោះជាមួយ CCLI',
    'Open CCLI SongSelect website': 'បើកគេហទំព័រ CCLI SongSelect',
    'Sign In': 'ចូលគណនី',
    'Sign Out': 'ចាកចេញពីគណនី',
    'Signed in': 'បានចូលគណនី',
    'Not signed in': 'មិនទាន់ចូលគណនីទេ',
    'Signing in...': 'កំពុងចូលគណនី...',
    'Set Client ID, Subscription Key and Redirect URI first':
        'សូមបំពេញ Client ID, Subscription Key និង Redirect URI ជាមុនសិន',
    'Signed in to SongSelect successfully': 'បានចូលគណនី SongSelect ដោយជោគជ័យ',
    'Signed out from SongSelect': 'បានចាកចេញពីគណនី SongSelect',
    'Sign in failed': 'ការចូលគណនីបរាជ័យ',
    'Sign in was canceled': 'ការចូលគណនីត្រូវបានបោះបង់',
    'Import From SongSelect': 'នាំចូលពី SongSelect',
    'Search songs': 'ស្វែងរកចម្រៀង',
    'Type to search': 'វាយអក្សរដើម្បីស្វែងរក',
    'Lyrics not available for this song': 'មិនមានអត្ថបទចម្រៀងសម្រាប់បទនេះទេ',
    'Not authorized for these lyrics': 'មិនមានសិទ្ធិប្រើអត្ថបទចម្រៀងនេះទេ',
    'Public Domain': 'កម្មសិទ្ធិសាធារណៈ',
    'SongSelect sign-in expired, please sign in again in Settings':
        'ការចូលគណនី SongSelect បានផុតកំណត់ ' +
        'សូមចូលគណនីម្តងទៀតនៅក្នុងការកំណត់',
    'Your account is not licensed for this content':
        'គណនីរបស់អ្នកមិនមានអាជ្ញាបណ្ណសម្រាប់មាតិកានេះទេ',
    'Too many requests, please wait a moment': 'សំណើច្រើនពេក សូមរង់ចាំបន្តិច',
    'Could not reach SongSelect': 'មិនអាចភ្ជាប់ទៅ SongSelect បានទេ',
    'SongSelect request failed': 'សំណើទៅ SongSelect បរាជ័យ',
    'Lyric document created successfully':
        'បានបង្កើតឯកសារអត្ថបទចម្រៀងដោយជោគជ័យ',
    'This song has no lyrics to import':
        'បទចម្រៀងនេះមិនមានអត្ថបទសម្រាប់នាំចូលទេ',
    '(dev) Use Mock Data': '(dev) ប្រើទិន្នន័យសាកល្បង',
    '(mock)': '(សាកល្បង)',
    // --- Public Domain Songs plugin: embedded hymn catalog importable as
    // lyric documents with no sign-in (2026-08-24).
    'Import From Public Domain Songs': 'នាំចូលពីចម្រៀងកម្មសិទ្ធិសាធារណៈ',
    'Failed to create lyric document': 'បរាជ័យក្នុងការបង្កើតឯកសារអត្ថបទចម្រៀង',
    // --- Connection graph (src/graph-view): a floating, pannable graph of a
    // record and everything it is related to (2026-08-29). The plural relation
    // labels the filter chips use (Parents, Children, Spouses, Siblings,
    // Cousins, Locations, Related locations) are already in this file and are
    // reused rather than repeated.
    'Open Graph Preview': 'បើកមើលក្រាបទំនាក់ទំនង',
    'Graph Preview': 'ក្រាបទំនាក់ទំនង',
    'Open all Related': 'បើកអ្វីៗដែលពាក់ព័ន្ធទាំងអស់',
    'No related records': 'គ្មានកំណត់ត្រាពាក់ព័ន្ធ',
    'Open detail': 'បើកព័ត៌មានលម្អិត',
    'Graph node limit reached': 'ដល់ដែនកំណត់ចំនួនប្រអប់ក្នុងក្រាបហើយ',
    'This will add many boxes to the graph. Continue?':
        'នេះនឹងបន្ថែមប្រអប់ច្រើនទៅក្នុងក្រាប។ បន្តទេ?',
    'Use as root': 'ប្រើជាចំណុចចាប់ផ្ដើម',
    'Set as centre': 'កំណត់ជាចំណុចកណ្ដាល',
    'Fit to view': 'ធ្វើឱ្យសមនឹងអេក្រង់',
    'Re-layout': 'រៀបចំជាថ្មី',
    Fullscreen: 'ពេញអេក្រង់',
    'Exit fullscreen': 'ចេញពីពេញអេក្រង់',
    Zoom: 'ពង្រីក',
    'Path from': 'ចាប់ពី',
    'Path to': 'ទៅ',
    Swap: 'ដូរ',
    'Find Connection': 'រកទំនាក់ទំនង',
    // `{count}` is the walk's step limit, put in by the caller: where the
    // number sits is the translation's to decide.
    'No connection found within {count} steps':
        'រកមិនឃើញទំនាក់ទំនងក្នុងចម្ងាយ {count} ជំហាន',
    'A location cannot be a path endpoint':
        'ទីតាំងមិនអាចជាចំណុចចាប់ផ្តើម ឬចុងបញ្ចប់បានទេ',
    'Mentioned by': 'បានរៀបរាប់ដោយ',
    'Save as image': 'រក្សាទុកជារូបភាព',
    // The text copies: the document, then one row per diagram language. The
    // format names stay Latin — `Markdown` is already in this file that way
    // (the music help), and every one of them is what the program the text is
    // pasted into calls itself. Only the direction is translated, since that
    // is the part a reader is choosing between.
    'Copy as Markdown': 'ចម្លងជា Markdown',
    // A menu row is clipped at 210px, so the two flowchart rows are named
    // short and carry the full name on their hover and on the toast.
    'Copy as Mermaid (across)': 'ចម្លងជា Mermaid (ផ្ដេក)',
    'Copy as Mermaid (down)': 'ចម្លងជា Mermaid (បញ្ឈរ)',
    'Copy as Mermaid Flowchart (left to right)':
        'ចម្លងជា Mermaid Flowchart (ពីឆ្វេងទៅស្តាំ)',
    'Copy as Mermaid Flowchart (top down)':
        'ចម្លងជា Mermaid Flowchart (ពីលើទៅក្រោម)',
    'Copy as Mermaid Mindmap': 'ចម្លងជា Mermaid ផែនទីគំនិត',
    'Copy as Graphviz DOT': 'ចម្លងជា Graphviz DOT',
    'Copy as PlantUML': 'ចម្លងជា PlantUML',
    // The same five formats named with no verb, for the rows that OPEN a
    // diagram instead of copying it. The three Mermaid shapes are what the
    // Mermaid Live Editor menu is made of; the other two carry a name because
    // the list declares one for every format. `Mindmap` is translated here and
    // in `Copy as Mermaid Mindmap` above, or one menu would name the same
    // shape two ways. The last two are product names and stand as they are.
    'Mermaid (across)': 'Mermaid (ផ្ដេក)',
    'Mermaid (down)': 'Mermaid (បញ្ឈរ)',
    'Mermaid Mindmap': 'Mermaid ផែនទីគំនិត',
    'Graphviz DOT': 'Graphviz DOT',
    PlantUML: 'PlantUML',
    'Open in Mermaid Live': 'បើកក្នុង Mermaid Live',
    'Open the diagram in the Mermaid Live Editor':
        'បើកដ្យាក្រាមក្នុងកម្មវិធីកែ Mermaid Live',
    'Opening in the Mermaid Live Editor':
        'កំពុងបើកក្នុងកម្មវិធីកែ Mermaid Live',
    // Said when the diagram is too long to hand the browser as a link; the
    // link goes to the clipboard instead, so the sentence has to say what to
    // do with it.
    'The link is too long for the browser. It has been copied — paste it into the address bar.':
        'តំណវែងពេកសម្រាប់កម្មវិធីរុករក។ វាត្រូវបានចម្លងរួចហើយ — សូមបិទភ្ជាប់វាទៅក្នុងរបារអាសយដ្ឋាន។',
    'Save preset': 'រក្សាទុកគំរូ',
    'Delete preset': 'លុបគំរូ',
    Presets: 'គំរូ',
    'Right-click to show only this': 'ចុចខាងស្តាំដើម្បីបង្ហាញតែមួយនេះ',
    All: 'ទាំងអស់',
    // Relation labels drawn on the edges. Lowercase because each reads as a
    // phrase sitting on a line ("son", "wife"), not as a heading — which is
    // also what keeps them distinct from the plural chip keys above.
    father: 'ឪពុក',
    mother: 'ម្តាយ',
    parent: 'ឪពុកម្តាយ',
    son: 'កូនប្រុស',
    daughter: 'កូនស្រី',
    child: 'កូន',
    husband: 'ប្តី',
    wife: 'ប្រពន្ធ',
    spouse: 'សហព័ទ្ធ',
    brother: 'បងប្អូនប្រុស',
    sister: 'បងប្អូនស្រី',
    sibling: 'បងប្អូន',
    cousin: 'ជីដូនមួយ',
    'located at': 'ស្ថិតនៅ',
    'related location': 'ទីតាំងពាក់ព័ន្ធ',
    // No lowercase `mentioned by` twin: keys are matched case-insensitively,
    // so it would collide with `Mentioned by` above and this module throws at
    // load on a duplicate. The one entry serves the chip and any edge label.

    // Verse-highlight colours (`VERSE_HIGHLIGHT_COLOR_KEYS`). They label the
    // selection toolbar's swatches and ARE the visible text of the recolour
    // menu, so without these the menu reads five English words beside a
    // translated `Delete`. Adding a colour there means adding a key here.
    yellow: 'លឿង',
    green: 'បៃតង',
    blue: 'ខៀវ',
    pink: 'ផ្កាឈូក',
    orange: 'ទឹកក្រូច',
    purple: 'ស្វាយ',

    // --- Keys on failure paths that had no Khmer at all (EN-20, 2026-09-18).
    // `src/lang/tranKeyCoverage.test.ts` now fails on a key like these.
    // Machine-authored Khmer following the dictionary's existing conventions;
    // a native speaker should review the phrasing.
    'Failed to apply to screen. Please make sure the screen is open.':
        'បរាជ័យក្នុងការដាក់ទៅអេក្រង់។ សូមប្រាកដថាអេក្រង់ត្រូវបានបើក។',
    'Failed to sync slide. Please make sure the screen is open.':
        'បរាជ័យក្នុងការធ្វើសមកាលកម្មស្លាយ។ សូមប្រាកដថាអេក្រង់ត្រូវបានបើក។',
    'Error occurred during reading image data from clipboard':
        'មានបញ្ហាពេលកំពុងអានទិន្នន័យរូបភាពពីក្តារចុច',
    'Error occurred during getting image file extension':
        'មានបញ្ហាពេលកំពុងទទួលបានកន្ទុយឯកសាររូបភាព',
    'We were sorry, but we are unable to get bible list at the moment please try again later':
        'សូមអភ័យទោស យើងមិនអាចទទួលបានបញ្ជីព្រះគម្ពីរនៅពេលនេះទេ សូមព្យាយាមម្តងទៀតនៅពេលក្រោយ',
    // --- Tooltips that were English in every language (EN-21, 2026-09-18):
    // the lookup history chips, the verse numbers, the divider arrows, the
    // Mini Screen card, the Bible Note footer. Machine-authored Khmer following
    // the dictionary's existing conventions; a native speaker should review.
    'Set to current editing': 'កំណត់ទៅការកែសម្រួលបច្ចុប្បន្ន',
    'Tab to complete': 'Tab ដើម្បីបំពេញ',
    'Double click to select verses': 'ចុចពីរដងដើម្បីជ្រើសរើសខគម្ពីរ',
    'Click to remove extra Bible': 'ចុចដើម្បីដកព្រះគម្ពីរបន្ថែមចេញ',
    'Collapse left panel': 'បង្រួមផ្ទាំងខាងឆ្វេង',
    'Collapse right panel': 'បង្រួមផ្ទាំងខាងស្តាំ',
    'Collapse top panel': 'បង្រួមផ្ទាំងខាងលើ',
    'Collapse bottom panel': 'បង្រួមផ្ទាំងខាងក្រោម',
    Screen: 'អេក្រង់',
    'Open in Markdown Editor': 'បើកក្នុងកម្មវិធីកែ Markdown',
    'Open Bible Lookup': 'បើកផ្ទាំងស្វែងរកព្រះគម្ពីរ',
    'Change Bible Key': 'ប្ដូរកូនសោរព្រះគម្ពីរ',
    // --- A data folder carried between computers and operating systems
    // (EN-22..35, 2026-09-19): file names every computer accepts, deleting on
    // a USB stick with no Recycle Bin. Machine-authored Khmer following the
    // dictionary's existing conventions; a native speaker should review.
    'Please type a name.': 'សូមវាយឈ្មោះ។',
    'A name cannot contain these characters, which some computers refuse:':
        'ឈ្មោះមិនអាចមានតួអក្សរទាំងនេះបានទេ ព្រោះកុំព្យូទ័រខ្លះមិនទទួលយក៖',
    'A name cannot start with a dot.': 'ឈ្មោះមិនអាចចាប់ផ្តើមដោយចំណុចបានទេ។',
    'A name cannot end with a dot or a space.':
        'ឈ្មោះមិនអាចបញ្ចប់ដោយចំណុច ឬដកឃ្លាបានទេ។',
    'This name is reserved by Windows. Please choose another one.':
        'ឈ្មោះនេះត្រូវបាន Windows បម្រុងទុក។ សូមជ្រើសរើសឈ្មោះផ្សេង។',
    'This name is too long. Please use a shorter one.':
        'ឈ្មោះនេះវែងពេក។ សូមប្រើឈ្មោះខ្លីជាងនេះ។',
    'Creating File': 'កំពុងបង្កើតឯកសារ',
    'Delete Permanently': 'លុបជាអចិន្ត្រៃយ៍',
    'could not be moved to the Recycle Bin or Trash. A USB flash drive has none on Windows. Delete it permanently? This cannot be undone.':
        'មិនអាចផ្លាស់ទីទៅធុងសំរាមបានទេ។ ឧបករណ៍ផ្ទុក USB គ្មានធុងសំរាមនៅលើ Windows ទេ។ លុបវាជាអចិន្ត្រៃយ៍ឬ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។',
    Retry: 'ព្យាយាមម្តងទៀត',
    // --- The data folder off the Desktop (2026-10-17): OneDrive backs up
    // the Desktop and took songs off it, so the default is
    // `~/.owa/open-worship-data` and a folder still on the Desktop is asked
    // about at launch (`src/setting/directory-setting/dataDirMove*`).
    'Move Your Data Folder Off the Desktop':
        'ផ្លាស់ទីថតទិន្នន័យរបស់អ្នកចេញពី Desktop',
    'Copy Data Folder': 'ចម្លងថតទិន្នន័យ',
    'Copy this data folder to a drive or another folder':
        'ចម្លងថតទិន្នន័យនេះទៅដ្រាយ ឬថតផ្សេង',
    'The data folder was not copied:': 'ថតទិន្នន័យមិនត្រូវបានចម្លងទេ៖',
    'The data folder was copied to': 'ថតទិន្នន័យត្រូវបានចម្លងទៅ',
    'Switch to the copy now? Every open window reloads.':
        'ប្តូរទៅច្បាប់ចម្លងឥឡូវនេះ? គ្រប់បង្អួចដែលបើកនឹងផ្ទុកឡើងវិញ។',
    'The copy cannot go inside the data folder itself.':
        'ច្បាប់ចម្លងមិនអាចដាក់នៅក្នុងថតទិន្នន័យខ្លួនឯងបានទេ។',
    'The Desktop is not a safe place for your data folder: backup and sync tools can move or empty it while the app is using it.':
        'Desktop មិនមែនជាកន្លែងសុវត្ថិភាពសម្រាប់ថតទិន្នន័យរបស់អ្នកទេ៖ កម្មវិធីបម្រុងទុក និងធ្វើសមកាលកម្ម អាចផ្លាស់ទី ឬធ្វើឱ្យវាទទេ ពេលកម្មវិធីកំពុងប្រើវា។',
    'Your songs, slides, Bibles and settings are kept in a folder on the Desktop:':
        'ចម្រៀង ស្លាយ ព្រះគម្ពីរ និងការកំណត់របស់អ្នក ត្រូវបានរក្សាទុកក្នុងថតមួយនៅលើ Desktop៖',
    'On Windows, Microsoft OneDrive often backs up the Desktop. While it syncs, OneDrive can replace your files with online-only copies or take them off this computer, so songs, slides and settings can suddenly go missing or come back empty.':
        'នៅលើ Windows កម្មវិធី Microsoft OneDrive តែងតែបម្រុងទុក (backup) Desktop។ ពេលកំពុងធ្វើសមកាលកម្ម OneDrive អាចប្តូរឯកសាររបស់អ្នកទៅជាច្បាប់ចម្លងដែលមានតែនៅលើអ៊ីនធឺណិត ឬយកវាចេញពីកុំព្យូទ័រនេះ ដូច្នេះចម្រៀង ស្លាយ និងការកំណត់ អាចបាត់ភ្លាមៗ ឬក្លាយជាទទេ។',
    'On a Mac, iCloud Drive can keep the Desktop in the cloud. It can take files off this computer and keep them only online, so songs, slides and settings can suddenly go missing.':
        'នៅលើ Mac កម្មវិធី iCloud Drive អាចរក្សាទុក Desktop នៅលើ cloud។ វាអាចយកឯកសារចេញពីកុំព្យូទ័រនេះ ហើយទុកវាតែនៅលើអ៊ីនធឺណិតប៉ុណ្ណោះ ដូច្នេះចម្រៀង ស្លាយ និងការកំណត់ អាចបាត់ភ្លាមៗ។',
    'Backup and sync tools often watch the Desktop, and can change or remove its files while the app is using them.':
        'កម្មវិធីបម្រុងទុក និងសមកាលកម្ម តែងតែតាមដាន Desktop ហើយអាចកែប្រែ ឬលុបឯកសាររបស់វា ខណៈពេលដែលកម្មវិធីនេះកំពុងប្រើពួកវា។',
    'To keep your data safe, the app can move it to a folder these backup tools do not touch:':
        'ដើម្បីរក្សាទិន្នន័យរបស់អ្នកឱ្យមានសុវត្ថិភាព កម្មវិធីអាចផ្លាស់ទីវាទៅថតមួយ ដែលកម្មវិធីបម្រុងទុកទាំងនេះមិនប៉ះពាល់៖',
    'The app closes and opens again to move it. Nothing is deleted: if the folder has to be copied, the old one stays where it is until you move it to the Recycle Bin (Trash) yourself.':
        'កម្មវិធីនឹងបិទ ហើយបើកឡើងវិញ ដើម្បីផ្លាស់ទីវា។ គ្មានអ្វីត្រូវបានលុបទេ៖ ប្រសិនបើត្រូវចម្លងថតនេះ ថតចាស់នឹងនៅកន្លែងដដែល រហូតដល់អ្នកផ្លាស់ទីវាទៅធុងសំរាមដោយខ្លួនឯង។',
    '"Not Now" asks again the next time the app starts.':
        '«មិនមែនឥឡូវនេះ» នឹងសួរម្តងទៀត នៅពេលកម្មវិធីបើកលើកក្រោយ។',
    'Move Now': 'ផ្លាស់ទីឥឡូវនេះ',
    'Data Folder Moved': 'បានផ្លាស់ទីថតទិន្នន័យ',
    'Your data folder is now in a safe place:':
        'ថតទិន្នន័យរបស់អ្នកឥឡូវនេះនៅកន្លែងដែលមានសុវត្ថិភាព៖',
    'The old copy is still at:': 'ច្បាប់ចម្លងចាស់នៅតែនៅ៖',
    'The app no longer uses it. When you are sure your songs, slides and settings are all here, move the old folder to the Recycle Bin (Trash) yourself.':
        'កម្មវិធីលែងប្រើវាទៀតហើយ។ នៅពេលអ្នកប្រាកដថា ចម្រៀង ស្លាយ និងការកំណត់របស់អ្នកមាននៅទីនេះទាំងអស់ សូមផ្លាស់ទីថតចាស់ទៅធុងសំរាមដោយខ្លួនឯង។',
    'Data Folder Not Moved': 'មិនបានផ្លាស់ទីថតទិន្នន័យទេ',
    'The data folder could not be moved, so the app keeps using it where it is. Nothing was changed.':
        'មិនអាចផ្លាស់ទីថតទិន្នន័យបានទេ ដូច្នេះកម្មវិធីនៅតែប្រើវានៅកន្លែងដដែល។ គ្មានអ្វីត្រូវបានផ្លាស់ប្តូរទេ។',
    'The app asks again the next time it starts.':
        'កម្មវិធីនឹងសួរម្តងទៀត នៅពេលវាបើកលើកក្រោយ។',
    'Old Copy of Your Data Folder': 'ច្បាប់ចម្លងចាស់នៃថតទិន្នន័យរបស់អ្នក',
    'Your data folder was moved here:':
        'ថតទិន្នន័យរបស់អ្នកត្រូវបានផ្លាស់ទីមកទីនេះ៖',
    'Moved on:': 'បានផ្លាស់ទីនៅ៖',
    'Show Folder': 'បង្ហាញថត',
    'Moving your data folder to a safe place. Please wait…':
        'កំពុងផ្លាស់ទីថតទិន្នន័យរបស់អ្នកទៅកន្លែងដែលមានសុវត្ថិភាព។ សូមរង់ចាំ…',
    'Some files in the data folder are only in iCloud Drive. Open the folder in Finder, choose Download Now, then try again.':
        'ឯកសារខ្លះក្នុងថតទិន្នន័យមានតែនៅក្នុង iCloud Drive ប៉ុណ្ណោះ។ សូមបើកថតនោះក្នុង Finder ជ្រើសរើស Download Now រួចព្យាយាមម្តងទៀត។',
    'The copy is not the same as the data folder, so it was not used.':
        'ច្បាប់ចម្លងមិនដូចថតទិន្នន័យទេ ដូច្នេះវាមិនត្រូវបានប្រើទេ។',
    'Open Worship App moved this data folder here.':
        'Open Worship App បានផ្លាស់ទីថតទិន្នន័យនេះមកទីនេះ។',
    'Open Worship App no longer uses this folder: it was copied to the place below. When you are sure everything is there, move this folder to the Recycle Bin (Trash) yourself.':
        'Open Worship App លែងប្រើថតនេះទៀតហើយ៖ វាត្រូវបានចម្លងទៅកន្លែងខាងក្រោម។ នៅពេលអ្នកប្រាកដថាអ្វីៗទាំងអស់មាននៅទីនោះ សូមផ្លាស់ទីថតនេះទៅធុងសំរាមដោយខ្លួនឯង។',
    'Create and use the standard folders (Documents, Videos, Images and the rest) inside':
        'បង្កើត និងប្រើថតស្តង់ដារ (ឯកសារ វីដេអូ រូបភាព និងផ្សេងទៀត) នៅក្នុង',
    'Repair Links': 'ជួសជុលតំណភ្ជាប់',
    'Point links to pictures, videos and songs that still name an old location of this data folder at where it is now':
        'ភ្ជាប់តំណទៅរូបភាព វីដេអូ និងចម្រៀង ដែលនៅតែចង្អុលទៅទីតាំងចាស់នៃថតទិន្នន័យនេះ ទៅកាន់ទីតាំងបច្ចុប្បន្នវិញ',
    'No links to an old location of this data folder were found.':
        'រកមិនឃើញតំណទៅទីតាំងចាស់នៃថតទិន្នន័យនេះទេ។',
    'Links repaired:': 'តំណដែលបានជួសជុល៖',
    'Files changed:': 'ឯកសារដែលបានកែប្រែ៖',
    'The app reloads to show them.':
        'កម្មវិធីនឹងផ្ទុកឡើងវិញ ដើម្បីបង្ហាញពួកវា។',
    'Recent Folders': 'ថតដែលបានប្រើថ្មីៗ',
    'Found Data Folders': 'ថតទិន្នន័យដែលបានរកឃើញ',
    Suggested: 'បានណែនាំ',
    'Use This Folder': 'ប្រើថតនេះ',
    Switch: 'ប្តូរ',
    'Switch Data Folder': 'ប្តូរថតទិន្នន័យ',
    'Switch to the data folder': 'ប្តូរទៅថតទិន្នន័យ',
    'Every open window reloads.': 'រាល់បង្អួចដែលកំពុងបើកនឹងផ្ទុកឡើងវិញ។',
    'Remove from Recent Folders': 'ដកចេញពីថតដែលបានប្រើថ្មីៗ',
    'This folder is not there any more.': 'ថតនេះលែងមាននៅទីនោះទៀតហើយ។',
    'Type the full path of the folder, for example':
        'សូមវាយផ្លូវពេញរបស់ថត ឧទាហរណ៍',
    'Create Data Folder': 'បង្កើតថតទិន្នន័យ',
    'There is no folder at': 'មិនមានថតនៅ',
    'Create it and use it as the data folder?':
        'តើចង់បង្កើតវា ហើយប្រើវាជាថតទិន្នន័យទេ?',
    Create: 'បង្កើត',
    // --- Page-aware Tips of the Day and their deterministic walkthroughs.
    'Tips of the Day': 'គន្លឹះប្រចាំថ្ងៃ',
    'Tip of the Day': 'គន្លឹះប្រចាំថ្ងៃ',
    'Presenter tip': 'គន្លឹះសម្រាប់អ្នកបង្ហាញ',
    'Reader tip': 'គន្លឹះសម្រាប់អ្នកអាន',
    'Show it': 'បង្ហាញរបៀប',
    'Next tip': 'គន្លឹះបន្ទាប់',
    'All tips': 'គន្លឹះទាំងអស់',
    'All Presenter tips': 'គន្លឹះទាំងអស់សម្រាប់អ្នកបង្ហាញ',
    'All Reader tips': 'គន្លឹះទាំងអស់សម្រាប់អ្នកអាន',
    'Back to tip': 'ត្រឡប់ទៅគន្លឹះ',
    'Choose a tip to practise at your own pace.':
        'ជ្រើសរើសគន្លឹះមួយ ដើម្បីហាត់រៀនតាមល្បឿនរបស់អ្នក។',
    'Hide for 30 days': 'លាក់រយៈពេល ៣០ ថ្ងៃ',
    'Show Tips of the Day automatically':
        'បង្ហាញគន្លឹះប្រចាំថ្ងៃដោយស្វ័យប្រវត្តិ',
    'Applies to the Presenter and Bible Reader on the next app launch.':
        'អនុវត្តចំពោះទំព័រអ្នកបង្ហាញ និងទំព័រអ្នកអានព្រះគម្ពីរ នៅពេលបើកកម្មវិធីលើកក្រោយ។',
    // --- The Settings list of what a hide button put away, for restoring.
    'Put away for 30 days': 'បានលាក់ទុករយៈពេល ៣០ ថ្ងៃ',
    'Tips in the help window': 'គន្លឹះនៅក្នុងបង្អួចជំនួយ',
    'The caution before an AI window opens': 'ការព្រមានុនពេលបើកបង្អួច AI',
    'The notice about the free AI service':
        'សេចក្តីជូនដំណឹងអំពីសេវា AI ឥតគិតថ្លៃ',
    'The suggestion to move the data folder': 'សំណើឱ្យផ្លាស់ទីថតទិន្នន័យ',
    'Hidden until': 'លាក់រហូតដល់',
    'Show again': 'បង្ហាញម្ដងទៀត',
    'Starting walkthrough…': 'កំពុងចាប់ផ្តើមការណែនាំ…',
    'This tip closes by itself': 'គន្លឹះនេះនឹងបិទដោយខ្លួនឯង',
    'Could not start this walkthrough.': 'មិនអាចចាប់ផ្តើមការណែនាំនេះបានទេ។',
    'File menu': 'ម៉ឺនុយ ឯកសារ',
    'Edit menu': 'ម៉ឺនុយ កែសម្រួល',
    'Tools menu': 'ម៉ឺនុយ ឧបករណ៍',
    'Window menu': 'ម៉ឺនុយ បង្អួច',
    'Help menu': 'ម៉ឺនុយ ជំនួយ',
    'Learn the File menu': 'រៀនអំពីម៉ឺនុយ ឯកសារ',
    'Learn Print, Print Without Preview, Export Data, Import Data, Close, and Quit or Exit.':
        'ស្វែងយល់អំពី Print, Print Without Preview, Export Data, Import Data, Close និង Quit ឬ Exit។',
    'Learn the Edit menu': 'រៀនអំពីម៉ឺនុយ កែសម្រួល',
    'Learn Undo, Redo, Cut, Copy, Paste, Paste and Match Style, Find, Delete, Select All, Settings, and Speech.':
        'ស្វែងយល់អំពី Undo, Redo, Cut, Copy, Paste, Paste and Match Style, Find, Delete, Select All, Settings និង Speech។',
    'Learn the Tools menu': 'រៀនអំពីម៉ឺនុយ ឧបករណ៍',
    'Learn Local Web Share, Google Fonts, App Assistant, AI Chat, Khmer Tools, and Start Controlling.':
        'ស្វែងយល់អំពី Local Web Share, Google Fonts, App Assistant, AI Chat, Khmer Tools និង Start Controlling។',
    'Learn the Window menu': 'រៀនអំពីម៉ឺនុយ បង្អួច',
    'Learn Minimize, Maximize or Zoom, Close, Bring All to Front, window switching, and Reset Position and Size.':
        'ស្វែងយល់អំពី Minimize, Maximize ឬ Zoom, Close, Bring All to Front, ការប្តូរបង្អួច និង Reset Position and Size។',
    'Learn the Help menu': 'រៀនអំពីម៉ឺនុយ ជំនួយ',
    'Learn Tips of the Day, All tips, Keyboard Shortcuts, Copy Debug Info, App Help (Chatbot), Learn More, Check for Updates, and About Open Worship app.':
        'ស្គាល់ គន្លឹះប្រចាំថ្ងៃ គន្លឹះទាំងអស់ ផ្លូវកាត់ក្ដារចុច Copy Debug Info App Help (Chatbot) Learn More Check for Updates និង About Open Worship app។',
    'Look up a Bible passage': 'ស្វែងរកបទគម្ពីរ',
    'Open Bible Lookup without leaving the Presenter.':
        'បើកការស្វែងរកព្រះគម្ពីរដោយមិនចាកចេញពីទំព័រអ្នកបង្ហាញ។',
    'Show or hide the Document List': 'បង្ហាញ ឬលាក់បញ្ជីឯកសារ',
    'Toggle the panel that holds your slide documents.':
        'បើក ឬបិទផ្ទាំងដែលផ្ទុកឯកសារស្លាយរបស់អ្នក។',
    'Show or hide the Presenting Flow List': 'បង្ហាញ ឬលាក់បញ្ជីតារាងកម្មវិធី',
    'Toggle the panel used to build and follow a service order.':
        'បើក ឬបិទផ្ទាំងសម្រាប់រៀបចំ និងតាមដានលំដាប់កម្មវិធី។',
    'Show or hide Bibles and Bible Notes':
        'បង្ហាញ ឬលាក់ព្រះគម្ពីរ និងកំណត់ត្រាព្រះគម្ពីរ',
    'Toggle the panel for saved passages and notes.':
        'បើក ឬបិទផ្ទាំងសម្រាប់បទគម្ពីរ និងកំណត់ត្រាដែលបានរក្សាទុក។',
    'Show or hide the Mini Screen': 'បង្ហាញ ឬលាក់អេក្រង់តូច',
    'Toggle the panel that previews and controls audience screens.':
        'បើក ឬបិទផ្ទាំងមើលជាមុន និងគ្រប់គ្រងអេក្រង់អ្នកទស្សនា។',
    'Give the Presenter more room': 'ពង្រីកកន្លែងសម្រាប់ទំព័រអ្នកបង្ហាញ',
    'Switch the Presenter between normal and full view.':
        'ប្តូរទំព័រអ្នកបង្ហាញរវាងទិដ្ឋភាពធម្មតា និងពេញ។',
    'Open Slide Editor in its own window':
        'បើកកម្មវិធីកែស្លាយក្នុងបង្អួចផ្ទាល់ខ្លួន',
    'Keep the Presenter visible while editing the selected document.':
        'រក្សាទំព័រអ្នកបង្ហាញឱ្យនៅមើលឃើញ ខណៈកំពុងកែឯកសារដែលបានជ្រើស។',
    'Open Bible Reader in its own window':
        'បើកអ្នកអានព្រះគម្ពីរក្នុងបង្អួចផ្ទាល់ខ្លួន',
    'Read or study without replacing the Presenter page.':
        'អាន ឬសិក្សាដោយមិនជំនួសទំព័រអ្នកបង្ហាញ។',
    'Open app Settings': 'បើកការកំណត់កម្មវិធី',
    'Change language, theme, folders, screens, and other app options.':
        'ប្តូរភាសា រូបរាង ថត អេក្រង់ និងជម្រើសកម្មវិធីផ្សេងៗ។',
    'Open the Help menu': 'បើកម៉ឺនុយជំនួយ',
    'Find app help, tips, updates, and information about the app.':
        'ស្វែងរកជំនួយ គន្លឹះ បច្ចុប្បន្នភាព និងព័ត៌មានអំពីកម្មវិធី។',
    'Open foreground controls': 'បើកការគ្រប់គ្រងផ្ទៃខាងមុខ',
    'Reach countdowns, clocks, marquees, and quick text.':
        'ប្រើការរាប់ថយក្រោយ នាឡិកា អក្សររត់ និងអត្ថបទរហ័ស។',
    'Foreground overlays': 'ស្រទាប់ផ្ទៃខាងមុខ',
    'Count down to the start of a service':
        'រាប់ថយក្រោយទៅកាន់ពេលចាប់ផ្តើមពិធីថ្វាយបង្គំ',
    'Countdown counts a number of minutes, or down to a time on the clock.':
        'Countdown រាប់ថយក្រោយតាមចំនួននាទី ឬទៅកាន់ម៉ោងជាក់លាក់។',
    'Time how long something is running': 'កត់ត្រារយៈពេលដែលកំពុងដំណើរការ',
    'Stopwatch counts up from zero on the audience screen.':
        'Stopwatch រាប់ឡើងពីសូន្យនៅលើអេក្រង់អ្នកទស្សនា។',
    'Show the time on the audience screen': 'បង្ហាញម៉ោងនៅលើអេក្រង់អ្នកទស្សនា',
    'Time puts one clock up, or several for different cities.':
        'Time បង្ហាញនាឡិកាមួយ ឬច្រើនសម្រាប់ទីក្រុងផ្សេងៗ។',
    'Scroll a line of text across the top': 'រំកិលអត្ថបទមួយជួរនៅផ្នែកខាងលើ',
    'Marquee Top is a moving notice above everything else on the screen.':
        'Marquee Top គឺជាសារមានចលនានៅពីលើអ្វីៗទាំងអស់នៅលើអេក្រង់។',
    'Scroll a line of text across the bottom':
        'រំកិលអត្ថបទមួយជួរនៅផ្នែកខាងក្រោម',
    'Marquee Bottom is the same moving notice, along the foot of the screen.':
        'Marquee Bottom គឺជាសារមានចលនាដដែល នៅផ្នែកខាងក្រោមអេក្រង់។',
    'Put a short message up for a moment': 'បង្ហាញសារខ្លីមួយក្នុងរយៈពេលខ្លី',
    'Quick Text puts a few words up that go again by themselves.':
        'Quick Text បង្ហាញពាក្យពីរបី ដែលបាត់ទៅវិញដោយខ្លួនឯង។',
    'Play a clip over the slide': 'ចាក់វីដេអូពីលើស្លាយ',
    'Video Show plays a clip above the background, the slide and the passage.':
        'Video Show ចាក់វីដេអូនៅពីលើផ្ទៃខាងក្រោយ ស្លាយ និងខគម្ពីរ។',
    'Lay a picture over the slide': 'ដាក់រូបភាពពីលើស្លាយ',
    'Image Show lays a logo, a frame or an announcement above everything else.':
        'Image Show ដាក់ឡូហ្គោ ស៊ុម ឬសេចក្តីជូនដំណឹងនៅពីលើអ្វីៗទាំងអស់។',
    'Show a camera over the slide': 'បង្ហាញកាមេរ៉ាពីលើស្លាយ',
    'Camera Show puts a live camera picture above the slide, not behind it.':
        'Camera Show ដាក់រូបភាពកាមេរ៉ាផ្ទាល់នៅពីលើស្លាយ មិនមែននៅពីក្រោយទេ។',
    'Show one screen inside another': 'បង្ហាញអេក្រង់មួយនៅក្នុងអេក្រង់មួយទៀត',
    'Screen Show puts the live picture of another screen above the slide.':
        'Screen Show ដាក់រូបភាពផ្ទាល់នៃអេក្រង់មួយទៀតនៅពីលើស្លាយ។',
    'Show a web page over the slide': 'បង្ហាញទំព័របណ្តាញពីលើស្លាយ',
    'Web Show puts a page or a small web file above the slide.':
        'Web Show ដាក់ទំព័របណ្តាញ ឬឯកសារបណ្តាញតូចនៅពីលើស្លាយ។',
    'Place and size a foreground item': 'កំណត់ទីតាំង និងទំហំធាតុផ្ទៃខាងមុខ',
    'Use Properties for position, size, opacity and blending.':
        'ប្រើផ្ទាំងលក្ខណសម្បត្តិសម្រាប់ទីតាំង ទំហំ ភាពថ្លា និងការលាយពណ៌។',
    'Keep the lines you use every week':
        'រក្សាទុកអត្ថបទដែលអ្នកប្រើរៀងរាល់សប្តាហ៍',
    'Save named sessions inside a foreground component.':
        'រក្សាទុកវគ្គដែលមានឈ្មោះនៅក្នុងធាតុផ្ទៃខាងមុខ។',
    'Take a foreground item back off': 'ដកធាតុផ្ទៃខាងមុខចេញវិញ',
    'Hide one component, or clear the whole foreground layer.':
        'លាក់ធាតុមួយ ឬសម្អាតស្រទាប់ផ្ទៃខាងមុខទាំងមូល។',
    'Open background colors': 'បើកពណ៌ផ្ទៃខាងក្រោយ',
    'Choose a solid color for the selected audience screens.':
        'ជ្រើសពណ៌តែមួយសម្រាប់អេក្រង់អ្នកទស្សនាដែលបានជ្រើស។',
    'Open background images': 'បើករូបភាពផ្ទៃខាងក្រោយ',
    'Browse still pictures available for screen backgrounds.':
        'រកមើលរូបភាពដែលមានសម្រាប់ផ្ទៃខាងក្រោយអេក្រង់។',
    'Open background videos': 'បើកវីដេអូផ្ទៃខាងក្រោយ',
    'Browse and control moving backgrounds.':
        'រកមើល និងគ្រប់គ្រងផ្ទៃខាងក្រោយមានចលនា។',
    'Open camera backgrounds': 'បើកកាមេរ៉ាជាផ្ទៃខាងក្រោយ',
    'Choose a connected camera as a live background source.':
        'ជ្រើសកាមេរ៉ាដែលបានភ្ជាប់ជាប្រភពផ្ទៃខាងក្រោយផ្ទាល់។',
    'Open website backgrounds': 'បើកគេហទំព័រជាផ្ទៃខាងក្រោយ',
    'Browse saved web pages used as screen backgrounds.':
        'រកមើលទំព័រវេបដែលបានរក្សាទុកសម្រាប់ប្រើជាផ្ទៃខាងក្រោយ។',
    'Open the audio library': 'បើកបណ្ណាល័យសំឡេង',
    'Browse music and other audio used during a service.':
        'រកមើលតន្ត្រី និងសំឡេងផ្សេងទៀតសម្រាប់ប្រើក្នុងកម្មវិធីថ្វាយបង្គំ។',
    'Change the open document folder': 'ប្តូរថតឯកសារដែលបានបើក',
    'Show the folder path box above the Document List.':
        'បង្ហាញប្រអប់ផ្លូវថតនៅខាងលើបញ្ជីឯកសារ។',
    'Find a document by name': 'ស្វែងរកឯកសារតាមឈ្មោះ',
    'Filter a long Document List without moving or deleting anything.':
        'ត្រងបញ្ជីឯកសារវែង ដោយមិនផ្លាស់ទី ឬលុបអ្វីឡើយ។',
    'Sort the Document List': 'តម្រៀបបញ្ជីឯកសារ',
    'Change how documents are ordered without changing their files.':
        'ប្តូរលំដាប់បង្ហាញឯកសារ ដោយមិនកែប្រែឯកសារដើម។',
    'Filter documents by type': 'ត្រងឯកសារតាមប្រភេទ',
    'Show only slides, lyrics, PDFs, or another document kind.':
        'បង្ហាញតែស្លាយ អត្ថបទចម្រៀង PDF ឬប្រភេទឯកសារផ្សេងទៀត។',
    'Pin the selected document': 'ខ្ទាស់ឯកសារដែលបានជ្រើស',
    'Keep presenting from one document while selecting another.':
        'បន្តបង្ហាញពីឯកសារមួយ ខណៈកំពុងជ្រើសឯកសារផ្សេង។',
    'Make slide thumbnails larger': 'ធ្វើរូបតូចស្លាយឱ្យធំជាងមុន',
    'Increase the preview size without changing audience output.':
        'បង្កើនទំហំមើលជាមុន ដោយមិនប្តូរអ្វីលើអេក្រង់អ្នកទស្សនា។',
    'Fit the selected document to width': 'ដាក់ឯកសារដែលបានជ្រើសឱ្យពេញទទឹង',
    'Toggle full-width document previews without changing the screen.':
        'ប្តូរទិដ្ឋភាពឯកសារពេញទទឹង ដោយមិនប្តូរអេក្រង់អ្នកទស្សនា។',
    'Write a note on a document or slide': 'សរសេរកំណត់ត្រាលើឯកសារ ឬស្លាយ',
    'Open the Note panel under the slide previews; it starts closed.':
        'បើកផ្ទាំងកំណត់ត្រានៅក្រោមរូបមើលជាមុនស្លាយ វាបិទតាំងពីដំបូង។',
    'Present a slide from a document': 'បង្ហាញស្លាយពីឯកសារ',
    'Select a document, then send one of its slide cards to the audience.':
        'ជ្រើសឯកសារ បន្ទាប់មកផ្ញើកាតស្លាយមួយរបស់វាទៅអ្នកទស្សនា។',
    'Auto-play slides on a timer': 'ចាក់ស្លាយដោយស្វ័យប្រវត្តិតាមម៉ោង',
    'Set a slide duration and let the selected document advance itself.':
        'កំណត់រយៈពេលស្លាយ ហើយឱ្យឯកសារដែលបានជ្រើសបន្តដោយខ្លួនឯង។',
    'Present song lyrics': 'បង្ហាញអត្ថបទចម្រៀង',
    'Choose a lyric document and present its generated stage slides.':
        'ជ្រើសឯកសារចម្រៀង ហើយបង្ហាញស្លាយឆាកដែលបានបង្កើត។',
    'Look up and present a Bible verse': 'ស្វែងរក និងបង្ហាញខព្រះគម្ពីរ',
    'Choose a passage, preview it, then send it to selected screens.':
        'ជ្រើសបទគម្ពីរ មើលជាមុន ហើយផ្ញើវាទៅអេក្រង់ដែលបានជ្រើស។',
    'Style Bible text on screen': 'កំណត់រចនាប័ទ្មអត្ថបទព្រះគម្ពីរលើអេក្រង់',
    'Change the Bible layer font, size, colors, spacing, and layout.':
        'ប្តូរពុម្ពអក្សរ ទំហំ ពណ៌ គម្លាត និងប្លង់នៃស្រទាប់ព្រះគម្ពីរ។',
    'Use a solid background color': 'ប្រើពណ៌តែមួយជាផ្ទៃខាងក្រោយ',
    'Choose a color and apply it only after checking the selected screens.':
        'ជ្រើសពណ៌ ហើយអនុវត្តវាបន្ទាប់ពីពិនិត្យអេក្រង់ដែលបានជ្រើស។',
    'Use an image background': 'ប្រើរូបភាពជាផ្ទៃខាងក្រោយ',
    'Choose a still picture and preview it before the audience sees it.':
        'ជ្រើសរូបភាព ហើយមើលជាមុន មុនពេលអ្នកទស្សនាឃើញវា។',
    'Use a video background': 'ប្រើវីដេអូជាផ្ទៃខាងក្រោយ',
    'Choose a video, preview playback, and control it safely.':
        'ជ្រើសវីដេអូ មើលការចាក់ជាមុន ហើយគ្រប់គ្រងវាដោយសុវត្ថិភាព។',
    'Use a camera background': 'ប្រើកាមេរ៉ាជាផ្ទៃខាងក្រោយ',
    'Choose a connected camera and check its live preview first.':
        'ជ្រើសកាមេរ៉ាដែលបានភ្ជាប់ ហើយពិនិត្យការមើលផ្ទាល់ជាមុន។',
    'Use a website background': 'ប្រើគេហទំព័រជាផ្ទៃខាងក្រោយ',
    'Create or choose a saved web item and preview its captured page.':
        'បង្កើត ឬជ្រើសធាតុវេបដែលបានរក្សាទុក ហើយមើលទំព័ររបស់វាជាមុន។',
    'Play audio during a service': 'ចាក់សំឡេងក្នុងកម្មវិធីថ្វាយបង្គំ',
    'Choose a saved audio file and use its playback controls.':
        'ជ្រើសឯកសារសំឡេងដែលបានរក្សាទុក ហើយប្រើការគ្រប់គ្រងចាក់របស់វា។',
    'Show a countdown, clock, or message': 'បង្ហាញការរាប់ថយក្រោយ នាឡិកា ឬសារ',
    'Use Foreground for timers, marquees, and quick text overlays.':
        'ប្រើផ្ទៃខាងមុខសម្រាប់ម៉ោង អក្សររត់ និងអត្ថបទរហ័សលើអេក្រង់។',
    'Control what the audience sees': 'គ្រប់គ្រងអ្វីដែលអ្នកទស្សនាឃើញ',
    'Use Mini Screen to show, hide, lock, or clear individual layers.':
        'ប្រើអេក្រង់តូចដើម្បីបង្ហាញ លាក់ ចាក់សោ ឬសម្អាតស្រទាប់នីមួយៗ។',
    'Use more than one audience screen': 'ប្រើអេក្រង់អ្នកទស្សនាច្រើនជាងមួយ',
    'Add screen cards, choose displays, and decide which screens receive content.':
        'បន្ថែមកាតអេក្រង់ ជ្រើសឧបករណ៍បង្ហាញ និងកំណត់អេក្រង់ដែលទទួលមាតិកា។',
    'Draw or spotlight on the app': 'គូរ ឬបំភ្លឺចំណុចលើកម្មវិធី',
    'Use Presenting Control for arrows, drawing, erasing, and focus.':
        'ប្រើការគ្រប់គ្រងការបង្ហាញសម្រាប់ព្រួញ ការគូរ ការលុប និងការផ្តោត។',
    'Show the keys you press': 'បង្ហាញគ្រាប់ចុចដែលអ្នកចុច',
    'Display keyboard shortcuts while teaching or demonstrating the app.':
        'បង្ហាញផ្លូវកាត់ក្តារចុច ខណៈកំពុងបង្រៀន ឬបង្ហាញកម្មវិធី។',
    'Download a background video or song': 'ទាញយកវីដេអូផ្ទៃខាងក្រោយ ឬបទចម្រៀង',
    'Use a supported public link to add video or audio to the library.':
        'ប្រើតំណសាធារណៈដែលគាំទ្រ ដើម្បីបន្ថែមវីដេអូ ឬសំឡេងទៅបណ្ណាល័យ។',
    'Build a service presenting flow': 'បង្កើតលំដាប់កម្មវិធីថ្វាយបង្គំ',
    'Arrange documents, passages, actions, and cues into a running order.':
        'រៀបចំឯកសារ បទគម្ពីរ សកម្មភាព និងសញ្ញាចូលជាលំដាប់ដំណើរការ។',
    'Share a presenting flow': 'ចែករំលែកលំដាប់បង្ហាញ',
    'Export a service order with the documents it references.':
        'នាំចេញលំដាប់កម្មវិធីជាមួយឯកសារដែលវាយោង។',
    'Import a song from SongSelect': 'នាំចូលបទចម្រៀងពី SongSelect',
    'Sign in, search the service, and bring a licensed song into Documents.':
        'ចូលគណនី ស្វែងរកសេវាកម្ម ហើយនាំបទចម្រៀងមានអាជ្ញាប័ណ្ណចូលឯកសារ។',
    'Import a public-domain hymn': 'នាំចូលបទទំនុកតម្កើងសាធារណៈ',
    'Browse the built-in hymn collection without an account.':
        'រកមើលសំណុំបទទំនុកតម្កើងដែលមានស្រាប់ ដោយមិនត្រូវការគណនី។',
    'Use the More Options buttons': 'ប្រើប៊ូតុងជម្រើសបន្ថែម',
    'Open the three-dot menu on a document, slide, background, or flow item.':
        'បើកម៉ឺនុយចំណុចបីលើឯកសារ ស្លាយ ផ្ទៃខាងក្រោយ ឬធាតុលំដាប់។',
    'Ask the App Assistant for help': 'សុំជំនួយពីអ្នកជំនួយការកម្មវិធី',
    'Ask about {name}': 'សួរអំពី {name}',
    '{name} is not in the Resources folders any more.':
        '{name} មិនមាននៅក្នុងថតធនធានទៀតទេ។',
    'Ask about the Presenter and request a safe step-by-step walkthrough.':
        'សួរអំពីទំព័រអ្នកបង្ហាញ និងស្នើការណែនាំម្តងមួយជំហានដោយសុវត្ថិភាព។',
    'Open an AI chat website': 'បើកគេហទំព័រជជែក AI',
    'Use ChatGPT, Claude, Gemini, or another supported site in a separate window.':
        'ប្រើ ChatGPT, Claude, Gemini ឬគេហទំព័រដែលគាំទ្រផ្សេងទៀតក្នុងបង្អួចដាច់ដោយឡែក។',
    'Find text anywhere in the app': 'ស្វែងរកអត្ថបទគ្រប់ទីកន្លែងក្នុងកម្មវិធី',
    'Use the Find bar to locate a document, setting, or visible control.':
        'ប្រើរបារស្វែងរកដើម្បីរកឯកសារ ការកំណត់ ឬប៊ូតុងដែលមើលឃើញ។',
    'Reload or force-reload the Presenter': 'ផ្ទុកទំព័រអ្នកបង្ហាញឡើងវិញ',
    'Use Reload normally; use Force Reload only to bypass cached app files.':
        'ប្រើផ្ទុកឡើងវិញជាធម្មតា; ប្រើផ្ទុកបង្ខំតែពេលចង់រំលងឯកសារឃ្លាំងបណ្តោះអាសន្ន។',
    'Use View > Toggle Developer Tools only for technical troubleshooting.':
        'ប្រើ មើល > ប្តូរឧបករណ៍អ្នកអភិវឌ្ឍន៍ សម្រាប់តែការដោះស្រាយបញ្ហាបច្ចេកទេស។',
    'Zoom the whole Presenter interface':
        'ពង្រីកចំណុចប្រទាក់ទំព័រអ្នកបង្ហាញទាំងមូល',
    'Use Actual Size, Zoom In, or Zoom Out for every panel and control.':
        'ប្រើទំហំពិត ពង្រីក ឬបង្រួម សម្រាប់ផ្ទាំង និងការគ្រប់គ្រងទាំងអស់។',
    'Make the whole Presenter full screen':
        'ធ្វើទំព័រអ្នកបង្ហាញទាំងមូលពេញអេក្រង់',
    'Use View > Toggle Full Screen or F11 for the entire app window.':
        'ប្រើ មើល > ប្តូរពេញអេក្រង់ ឬ F11 សម្រាប់បង្អួចកម្មវិធីទាំងមូល។',
    'Show or hide Presenter panels from View':
        'បង្ហាញ ឬលាក់ផ្ទាំងអ្នកបង្ហាញពីម៉ឺនុយ មើល',
    'Use View > Widgets to choose which Presenter panels are open.':
        'ប្រើ មើល > Widgets ដើម្បីជ្រើសផ្ទាំងអ្នកបង្ហាញដែលត្រូវបើក។',
    'Restore every Presenter panel layout': 'ស្តារប្លង់ផ្ទាំងអ្នកបង្ហាញទាំងអស់',
    'Use View > Reset Widgets Size to restore defaults after confirmation.':
        'ប្រើ មើល > កំណត់ទំហំ Widgets ឡើងវិញ ដើម្បីស្តារលំនាំដើមបន្ទាប់ពីបញ្ជាក់។',
    'Documents and slides': 'ឯកសារ និងស្លាយ',
    'Audience screens': 'អេក្រង់អ្នកទស្សនា',
    'Background and media': 'ផ្ទៃខាងក្រោយ និងមេឌៀ',
    'Service planning': 'ការរៀបចំកម្មវិធីថ្វាយបង្គំ',
    'Make the words larger': 'ធ្វើឱ្យអក្សរធំជាងមុន',
    'Press Reveal Hidden Controls under the passage, then raise Font Size.':
        'ចុច បង្ហាញប៊ូតុងដែលលាក់ នៅក្រោមបទគម្ពីរ រួចបង្កើន ទំហំតួអក្សរ។',
    'Find words in the Bible': 'ស្វែងរកពាក្យក្នុងព្រះគម្ពីរ',
    'Open Bible Find, then put the caret in its search box.':
        'បើកការស្វែងរកព្រះគម្ពីរ រួចដាក់ទស្សន៍ទ្រនិចក្នុងប្រអប់ស្វែងរក។',
    'Look up a Bible person or place': 'ស្វែងរកបុគ្គល ឬទីកន្លែងក្នុងព្រះគម្ពីរ',
    'Open the names and locations lookup beside the passage.':
        'បើកការស្វែងរកឈ្មោះ និងទីកន្លែងនៅក្បែរបទគម្ពីរ។',
    'Put two Bible versions side by side': 'ដាក់ព្រះគម្ពីរពីរកំណែនៅក្បែរគ្នា',
    'Open the version picker for a second Bible column.':
        'បើកឧបករណ៍ជ្រើសកំណែសម្រាប់ជួរឈរព្រះគម្ពីរទីពីរ។',
    'Toggle distraction-free reading': 'ប្តូរទៅការអានដោយគ្មានការរំខាន',
    'Enter or leave the full reading view.': 'ចូល ឬចាកចេញពីទិដ្ឋភាពអានពេញ។',
    'Toggle the side panel that keeps saved passages and notes.':
        'បើក ឬបិទផ្ទាំងចំហៀងសម្រាប់បទគម្ពីរ និងកំណត់ត្រាដែលបានរក្សាទុក។',
    'Search tips': 'ស្វែងរកគន្លឹះ',
    'No tips found': 'រកមិនឃើញគន្លឹះ',
    'Getting started': 'ចាប់ផ្តើម',
    'Reading and layout': 'ការអាន និងប្លង់',
    'Notes and marks': 'កំណត់ត្រា និងសញ្ញាសម្គាល់',
    'Reader shortcuts': 'ឧបករណ៍អ្នកអាន',
    'View menu': 'ម៉ឺនុយ មើល',
    'Study tools': 'ឧបករណ៍សិក្សា',
    'Find a saved Bible list': 'រកបញ្ជីព្រះគម្ពីរដែលបានរក្សាទុក',
    'Use Filter by name and Sort at the top of Bibles to find a passage list quickly.':
        'ប្រើ ត្រងតាមឈ្មោះ និង តម្រៀប នៅខាងលើ ព្រះគម្ពីរ ដើម្បីរកបញ្ជីបទគម្ពីរបានលឿន។',
    'Fix a Bible that is not installed': 'ដោះស្រាយព្រះគម្ពីរដែលមិនទាន់បានដំឡើង',
    'When the Reader names a Bible you do not have, pick another, press Let the assistant import this Bible for me, or Go to Bible Setting.':
        'ពេលកម្មវិធីអានស្នើព្រះគម្ពីរដែលអ្នកមិនមាន ជ្រើសមួយផ្សេង ចុច ឱ្យជំនួយការនាំចូលព្រះគម្ពីរនេះជំនួសខ្ញុំ ឬ ទៅកាន់ការកំណត់ព្រះគម្ពីរ។',
    'Or press Let the assistant import a Bible for me: the Assistant offers the KJV the app itself provides first, then looks for a Bible in your language in a free online collection.':
        'ឬចុច ឱ្យជំនួយការនាំចូលព្រះគម្ពីរមួយសម្រាប់ខ្ញុំ៖ ជំនួយការផ្តល់ KJV ដែលកម្មវិធីផ្តល់ជូនជាមុន រួចរកព្រះគម្ពីរជាភាសារបស់អ្នកក្នុងបណ្ដុំឥតគិតថ្លៃនៅលើអ៊ីនធឺណិត។',
    'Use verse numbers inside a passage': 'ប្រើលេខខនៅក្នុងបទគម្ពីរ',
    'Click a verse number to show its notes or double-click it to select the verse; Show the next chapter loads more of a long passage.':
        'ចុចលេខខដើម្បីមើលកំណត់ត្រារបស់វា ឬចុចពីរដងដើម្បីជ្រើសខនោះ; បង្ហាញជំពូកបន្ទាប់ ផ្ទុកបទគម្ពីរវែងបន្ថែម។',
    'Open a name from the passage text': 'បើកឈ្មោះពីអត្ថបទបទគម្ពីរ',
    'Click a dotted name in the passage to open its details; Full view, collapse or close that floating panel.':
        'ចុចឈ្មោះដែលមានចំណុចក្នុងបទគម្ពីរ ដើម្បីបើកព័ត៌មានលម្អិត; ទិដ្ឋភាពពេញ បង្រួម ឬបិទផ្ទាំងអណ្តែតនោះ។',
    'Make the words smaller': 'ធ្វើឱ្យអក្សរតូចជាងមុន',
    'Press Reveal Hidden Controls under the passage, then lower Font Size.':
        'ចុច បង្ហាញប៊ូតុងដែលលាក់ នៅក្រោមបទគម្ពីរ រួចបន្ថយ ទំហំតួអក្សរ។',
    'Open John 3:16 with buttons': 'បើក យ៉ូហាន ៣:១៦ ដោយប៊ូតុង',
    'Choose the book, chapter and verse without typing a reference.':
        'ជ្រើសសៀវភៅ ជំពូក និងខ ដោយមិនចាំបាច់វាយសេចក្ដីយោង។',
    'Go back to the previous passage': 'ត្រឡប់ទៅអត្ថបទមុន',
    'Use the passage history without typing the reference again.':
        'ប្រើប្រវត្តិអត្ថបទ ដោយមិនបាច់វាយសេចក្ដីយោងម្ដងទៀត។',
    'Go forward to the next passage': 'ទៅមុខកាន់អត្ថបទបន្ទាប់',
    'Move forward again after using passage history.':
        'ទៅមុខម្ដងទៀត បន្ទាប់ពីប្រើប្រវត្តិអត្ថបទ។',
    'Clear the reference box': 'សម្អាតប្រអប់សេចក្ដីយោង',
    "Press Clear input (Shift+Escape) to show this Bible's book buttons and start a fresh lookup.":
        'ចុច លុបទិន្នន័យកំពុងបញ្ចូល (Shift+Escape) ដើម្បីបង្ហាញប៊ូតុងសៀវភៅរបស់ព្រះគម្ពីរ ហើយចាប់ផ្ដើមស្វែងរកថ្មី។',
    'Change names and places language': 'ប្ដូរភាសាឈ្មោះ និងទីកន្លែង',
    'Remove the last part of a reference': 'លុបផ្នែកចុងក្រោយនៃសេចក្ដីយោង',
    'Press Clear input chunk (Escape) to keep the book or chapter and correct only the last choice.':
        'ចុច លុបផ្នែកទិន្នន័យកំពុងបញ្ចូល (Escape) ដើម្បីរក្សាសៀវភៅ ឬជំពូក ហើយកែតែជម្រើសចុងក្រោយ។',
    'Show or hide saved Bibles': 'បង្ហាញ ឬលាក់ព្រះគម្ពីរដែលបានរក្សាទុក',
    'Use View > Widgets to show or hide only the saved Bibles section.':
        'ប្រើ មើល > ធាតុក្រាហ្វិក ដើម្បីបង្ហាញ ឬលាក់តែផ្នែកព្រះគម្ពីរដែលបានរក្សាទុក។',
    'Show or hide Bible Notes': 'បង្ហាញ ឬលាក់កំណត់ត្រាព្រះគម្ពីរ',
    'Use View > Widgets to show or hide only the Bible Notes section.':
        'ប្រើ មើល > ធាតុក្រាហ្វិក ដើម្បីបង្ហាញ ឬលាក់តែផ្នែកកំណត់ត្រាព្រះគម្ពីរ។',
    'Filter Bible Notes by name': 'ត្រងកំណត់ត្រាព្រះគម្ពីរតាមឈ្មោះ',
    'Focus Filter by name, then type part of the note you need.':
        'ដាក់ទស្សន៍ទ្រនិចក្នុង ត្រងតាមឈ្មោះ ហើយវាយផ្នែកនៃកំណត់ត្រាដែលអ្នកត្រូវការ។',
    'Choose how Bible Notes are sorted': 'ជ្រើសរបៀបតម្រៀបកំណត់ត្រាព្រះគម្ពីរ',
    'Open Sort and choose one of the available list orders.':
        'បើក តម្រៀប ហើយជ្រើសលំដាប់បញ្ជីមួយដែលមាន។',
    'Open Reader Settings': 'បើកការកំណត់អ្នកអាន',
    'Open Settings from the Reader header without leaving your passage.':
        'បើកការកំណត់ពីក្បាលទំព័រអ្នកអាន ដោយមិនចាកចេញពីអត្ថបទរបស់អ្នក។',
    'Open Reader Help': 'បើកជំនួយអ្នកអាន',
    'Open Help in the Reader header for Open Online Help, Open Chatbot and Report a Problem.':
        'បើក ជំនួយ នៅក្បាលកម្មវិធីអាន សម្រាប់ បើកជំនួយតាមអ៊ីនធឺណិត បើក Chatbot និង រាយការណ៍បញ្ហា។',
    'Open Names and locations language to choose the language of people and places data.':
        'បើក ភាសាឈ្មោះ និងទីកន្លែង ដើម្បីជ្រើសភាសានៃទិន្នន័យបុគ្គល និងទីកន្លែង។',
    'Choose how to copy a passage': 'ជ្រើសរបៀបចម្លងអត្ថបទ',
    'Open the Copy menu for the passage you are reading.':
        'បើកម៉ឺនុយ ចម្លង សម្រាប់អត្ថបទដែលអ្នកកំពុងអាន។',
    'Split the passage side by side': 'បំបែកអត្ថបទដាក់ក្បែរគ្នា',
    'Make a second reading pane to the right.':
        'បង្កើតផ្ទាំងអានទីពីរនៅខាងស្ដាំ។',
    'Split the passage top and bottom': 'បំបែកអត្ថបទខាងលើ និងខាងក្រោម',
    'Make a second reading pane underneath.': 'បង្កើតផ្ទាំងអានទីពីរនៅខាងក្រោម។',
    'Save this passage in Bibles': 'រក្សាទុកអត្ថបទនេះក្នុង ព្រះគម្ពីរ',
    'Keep the passage in your Bibles list for later.':
        'ទុកអត្ថបទក្នុងបញ្ជីព្រះគម្ពីរ ដើម្បីអាននៅពេលក្រោយ។',
    'Put a passage on the audience screens': 'ដាក់អត្ថបទលើអេក្រង់អ្នកទស្សនា',
    'The Bible Reader only reads: present a passage from the Presenter, and use F9 there to clear it.':
        'អានព្រះគម្ពីរគ្រាន់តែសម្រាប់អានប៉ុណ្ណោះ៖ បង្ហាញអត្ថបទពីកម្មវិធីបង្ហាញ ហើយប្រើ F9 នៅទីនោះដើម្បីលុបវា។',
    'Start automatic scrolling': 'ចាប់ផ្ដើមរំកិលដោយស្វ័យប្រវត្តិ',
    'Let a long passage move down by itself.':
        'ឱ្យអត្ថបទវែងរំកិលចុះដោយខ្លួនឯង។',
    'Jump back to the top': 'ត្រឡប់ទៅខាងលើភ្លាមៗ',
    'Return to the beginning of a long passage.': 'ត្រឡប់ទៅដើមនៃអត្ថបទវែង។',
    'Toggle natural Bible line breaks': 'ប្ដូរការចុះបន្ទាត់តាមព្រះគម្ពីរ',
    "Choose whether the passage follows the Bible's own line breaks.":
        'ជ្រើសថាតើអត្ថបទត្រូវធ្វើតាមការចុះបន្ទាត់របស់ព្រះគម្ពីរឬអត់។',
    'Toggle model-based line breaks': 'ប្ដូរការចុះបន្ទាត់តាមគំរូ',
    'Choose whether supported Bibles use their formatting model.':
        'ជ្រើសថាតើព្រះគម្ពីរដែលគាំទ្រ ត្រូវប្រើគំរូទ្រង់ទ្រាយរបស់វាឬអត់។',
    'Open cross references': 'បើកសេចក្ដីយោងឆ្លង',
    'See AI Cross References for your passage, or right-click a verse you are editing and choose Open in Cross Reference.':
        'មើល AI ខគម្ពីរយោង សម្រាប់បទគម្ពីររបស់អ្នក ឬចុចស្ដាំលើខដែលអ្នកកំពុងកែ ហើយជ្រើស បើកនៅក្នុងឯកសារយោងឆ្លង។',
    'See people and places in this passage':
        'មើលមនុស្ស និងទីកន្លែងក្នុងអត្ថបទនេះ',
    'Open the names and locations found in what you are reading.':
        'បើកឈ្មោះ និងទីកន្លែងដែលមានក្នុងអត្ថបទដែលអ្នកកំពុងអាន។',
    'Open passage resources': 'បើកធនធានរបស់អត្ថបទ',
    'Show study resources for the passage beside the Bible.':
        'បង្ហាញធនធានសិក្សារបស់អត្ថបទនៅក្បែរព្រះគម្ពីរ។',
    'Search only selected Bible books': 'ស្វែងរកតែក្នុងសៀវភៅដែលបានជ្រើស',
    'Find a verse you half-remember': 'ស្វែងរកខគម្ពីរដែលអ្នកចាំបានតែខ្លះ',
    'In Bible Find, press Find a Verse with the Assistant at the end of the All Books row, pick the Bible, then type the words you remember or what the verse is about.':
        'ក្នុងការស្វែងរកព្រះគម្ពីរ ចុច ស្វែងរកខគម្ពីរជាមួយជំនួយការ នៅចុងជួរ សៀវភៅទាំងអស់ ជ្រើសរើសព្រះគម្ពីរ រួចវាយពាក្យដែលអ្នកចាំបាន ឬអ្វីដែលខនោះនិយាយអំពី។',
    'Open All Books in Bible Find to search only some books; its menu offers Reset Selected Books and Reset Search Data.':
        'បើក សៀវភៅទាំងអស់ ក្នុងការស្វែងរកព្រះគម្ពីរ ដើម្បីស្វែងរកតែសៀវភៅខ្លះ; ម៉ឺនុយរបស់វាមាន កំណត់សៀវភៅដែលបានជ្រើសរើសឡើងវិញ និង កំណត់ទិន្នន័យស្វែងរកឡើងវិញ។',
    'Type a complete Bible reference': 'វាយសេចក្ដីយោងព្រះគម្ពីរពេញលេញ',
    'Enter a reference such as John 3:16 and open it directly.':
        'បញ្ចូលសេចក្ដីយោងដូចជា យ៉ូហាន ៣:១៦ ហើយបើកវាដោយផ្ទាល់។',
    'Use the reference box shortcuts': 'ប្រើផ្លូវកាត់ក្នុងប្រអប់សេចក្ដីយោង',
    'Tab to complete (Tab) finishes a choice, Clear input chunk (Escape) removes one part, Clear input (Shift+Escape) clears all.':
        'Tab ដើម្បីបំពេញ (Tab) បំពេញជម្រើស លុបផ្នែកទិន្នន័យកំពុងបញ្ចូល (Escape) លុបមួយផ្នែក ហើយ លុបទិន្នន័យកំពុងបញ្ចូល (Shift+Escape) លុបទាំងអស់។',
    'Reuse and arrange passage history': 'ប្រើឡើងវិញ និងរៀបចំប្រវត្តិអត្ថបទ',
    'Click a history chip to read it, or use its More Options: Open beside the current verse, Set to current editing, Save bible item, Remove.':
        'ចុចប្រវត្តិមួយដើម្បីអាន ឬប្រើ ជម្រើសបន្ថែម របស់វា៖ បើកនៅក្បែរខបច្ចុប្បន្ន កំណត់ទៅការកែសម្រួលបច្ចុប្បន្ន រក្សាទុកធាតុព្រះគម្ពីរ លុបចេញ។',
    'Change version and read Bible information':
        'ប្ដូរកំណែ និងអានព័ត៌មានព្រះគម្ពីរ',
    'Choose a translation with the version button or Add New Bible, then open Bible Information for its publisher and copyright.':
        'ជ្រើសការបកប្រែដោយប៊ូតុងកំណែ ឬ បន្ថែមព្រះគម្ពីរថ្មី រួចបើក ព័ត៌មានព្រះគម្ពីរ ដើម្បីមើលអ្នកបោះពុម្ព និងសិទ្ធិអ្នកនិពន្ធ។',
    'Choose one verse or a verse range': 'ជ្រើសខមួយ ឬចន្លោះខ',
    'Pick a verse for the start and another for the end, Show all verses for the chapter, or Introduction where a book has one.':
        'ជ្រើសខមួយសម្រាប់ចាប់ផ្ដើម និងមួយទៀតសម្រាប់បញ្ចប់ បង្ហាញខគម្ពីរទាំងអស់ សម្រាប់ជំពូក ឬ សេចក្ដីផ្ដើម ពេលសៀវភៅមានវា។',
    'Use dictionary and Word export': 'ប្រើវចនានុក្រម និងនាំចេញទៅ Word',
    'Look up selected words in Wiki Dictionary or export a passage to Microsoft Word.':
        'ស្វែងរកពាក្យដែលបានជ្រើសក្នុង Wiki Dictionary ឬនាំចេញអត្ថបទទៅ Microsoft Word។',
    'Use Bible audio and AI reading controls':
        'ប្រើសំឡេងព្រះគម្ពីរ និងការគ្រប់គ្រងអានដោយ AI',
    'Turn on Auto Play Audio AI in Settings; where a Bible has audio, Toggle Bible Audio in its passage header turns the player on or off.':
        'បើក Auto Play Audio AI ក្នុង ការកំណត់; ពេលព្រះគម្ពីរមានសំឡេង បិទ ឬបើកសំលេងព្រះគម្ពីរ នៅក្បាលបទគម្ពីរ បើក ឬបិទឧបករណ៍ចាក់។',
    'Edit and arrange reading panes': 'កែសម្រួល និងរៀបចំផ្ទាំងអាន',
    "Edit a pane's reference with Click to edit this section or its Book, Chapter and Verse Start buttons, change its version, or close it.":
        'កែសេចក្ដីយោងរបស់ផ្ទាំងដោយ ចុចដើម្បីកែសម្រួលផ្នែកនេះ ឬប៊ូតុង កណ្ឌ ជំពូក និង ខចាប់ផ្ដើម របស់វា ប្ដូរកំណែ ឬបិទវា។',
    'Master Bible Find results': 'ប្រើលទ្ធផលស្វែងរកព្រះគម្ពីរឱ្យស្ទាត់',
    'Pick the version, page through hits, then Open, Open beside the current verse or Save bible item; Refresh runs the search again.':
        'ជ្រើសកំណែ មើលលទ្ធផលតាមទំព័រ រួច បើក បើកនៅក្បែរខបច្ចុប្បន្ន ឬ រក្សាទុកធាតុព្រះគម្ពីរ; ផ្ទុកឡើងវិញ ស្វែងរកម្ដងទៀត។',
    'Explore people and place details': 'ស្វែងយល់ព័ត៌មានមនុស្ស និងទីកន្លែង',
    'Select a record, then use Parents, Children and other sections, Open in bible lookup, Open in another Bible, Copy or Open in Google Maps.':
        'ជ្រើសកំណត់ត្រាមួយ រួចប្រើ ឪពុកម្ដាយ កូន និងផ្នែកផ្សេងៗ បើកក្នុងការស្វែងរកព្រះគម្ពីរ បើកក្នុងព្រះគម្ពីរផ្សេងទៀត ចម្លង ឬ បើកក្នុង Google Maps។',
    'Explore the connection graph': 'ស្វែងយល់ក្រាបទំនាក់ទំនង',
    'Open a graph from a record, expand relations, filter, drag, pan, zoom, and find connections.':
        'បើកក្រាបពីកំណត់ត្រា ពង្រីកទំនាក់ទំនង តម្រង អូស រំកិល ពង្រីក និងស្វែងរកការតភ្ជាប់។',
    'Organize and share a connection graph': 'រៀបចំ និងចែករំលែកក្រាបទំនាក់ទំនង',
    'Re-layout, Undo, Set as centre or Use as root, then copy, save, print, or open the drawn view.':
        'រៀបចំជាថ្មី ត្រឡប់ក្រោយ កំណត់ជាចំណុចកណ្ដាល ឬ ប្រើជាចំណុចចាប់ផ្ដើម រួចចម្លង រក្សាទុក បោះពុម្ព ឬបើកទិដ្ឋភាពដែលបានគូរ។',
    'Organize passage resources by filename': 'រៀបចំធនធានតាមឈ្មោះឯកសារ',
    'Name files by book and chapter so they appear beside the right passage.':
        'ដាក់ឈ្មោះឯកសារតាមសៀវភៅ និងជំពូក ដើម្បីឱ្យវាបង្ហាញក្បែរអត្ថបទត្រឹមត្រូវ។',
    'Build and use your Resources library': 'បង្កើត និងប្រើបណ្ណាល័យធនធាន',
    'Add or drop folders, search and reload them, open files or links, add files, or copy them into app data.':
        'បន្ថែម ឬទម្លាក់ថត ស្វែងរក និងផ្ទុកវាឡើងវិញ បើកឯកសារ ឬតំណ បន្ថែមឯកសារ ឬចម្លងវាទៅទិន្នន័យកម្មវិធី។',
    'Highlight and comment on Bible text':
        'រំលេច និងដាក់មតិយោបល់លើអត្ថបទព្រះគម្ពីរ',
    'Select words in one verse, then use Highlight, Add Comment or Remove Marks; Delete Comment takes a comment off.':
        'ជ្រើសពាក្យក្នុងខមួយ រួចប្រើ គូសបន្លិច បន្ថែមមតិយោបល់ ឬ លុបសញ្ញាសម្គាល់; លុបមតិយោបល់ ដកមតិយោបល់ចេញ។',
    'Work with marked verses in Bible Notes':
        'ធ្វើការជាមួយខដែលបានសម្គាល់ក្នុងកំណត់ត្រាព្រះគម្ពីរ',
    'Open, recolor, edit or move a marked verse, drag it into Bibles, or use Add to Bible List.':
        'បើក ប្ដូរពណ៌ កែ ឬផ្លាស់ទីខដែលបានសម្គាល់ អូសវាចូល ព្រះគម្ពីរ ឬប្រើ បន្ថែមទៅបញ្ជីព្រះគម្ពីរ។',
    'Use the Reader header tools': 'ប្រើឧបករណ៍ក្បាលទំព័រអ្នកអាន',
    'Use Go Back to Presenter, Setting, App Assistant, AI Chat, and Help: Open Online Help, Open Chatbot or Report a Problem.':
        'ប្រើ ត្រឡប់ទៅកម្មវិធីបង្ហាញ ការកំណត់ ជំនួយការកម្មវិធី ជជែក AI និង ជំនួយ៖ បើកជំនួយតាមអ៊ីនធឺណិត បើក Chatbot ឬ រាយការណ៍បញ្ហា។',
    'Reload or force-reload the Reader': 'ផ្ទុកអ្នកអានឡើងវិញ ឬបង្ខំផ្ទុកឡើងវិញ',
    'Use Reload for a normal refresh; use Force Reload only to bypass cached app files.':
        'ប្រើ ផ្ទុកឡើងវិញ សម្រាប់ធម្មតា; ប្រើ បង្ខំផ្ទុកឡើងវិញ តែពេលចង់រំលងឯកសារឃ្លាំងប៉ុណ្ណោះ។',
    'Restart the whole app with Relaunch':
        'ចាប់ផ្ដើមកម្មវិធីទាំងមូលឡើងវិញដោយ Relaunch',
    'Use View > Relaunch when every app window needs a clean restart; the app asks first.':
        'ប្រើ មើល > Relaunch ពេលបង្អួចទាំងអស់ត្រូវចាប់ផ្ដើមថ្មី; កម្មវិធីនឹងសួរបញ្ជាក់ជាមុន។',
    'Open Developer Tools for diagnostics':
        'បើកឧបករណ៍អ្នកអភិវឌ្ឍន៍សម្រាប់វិនិច្ឆ័យ',
    'Use View > Toggle Developer Tools only when troubleshooting or collecting technical details.':
        'ប្រើ មើល > ប្ដូរឧបករណ៍អ្នកអភិវឌ្ឍន៍ តែពេលដោះស្រាយបញ្ហា ឬប្រមូលព័ត៌មានបច្ចេកទេស។',
    'Zoom the whole Reader interface': 'ពង្រីកចំណុចប្រទាក់អ្នកអានទាំងមូល',
    'Use Actual Size, Zoom In, or Zoom Out for the whole window; Font Size changes Bible text only.':
        'ប្រើ ទំហំពិត ពង្រីក ឬបង្រួម សម្រាប់បង្អួចទាំងមូល; ទំហំអក្សរ ប្ដូរតែអត្ថបទព្រះគម្ពីរ។',
    'Make the whole app window full screen':
        'ធ្វើឱ្យបង្អួចកម្មវិធីទាំងមូលពេញអេក្រង់',
    'Use View > Toggle Full Screen or F11; the passage Full button is the reading-only alternative.':
        'ប្រើ មើល > ប្ដូរពេញអេក្រង់ ឬ F11; ប៊ូតុង ពេញ ក្នុងអត្ថបទ ពង្រីកតែផ្ទៃអាន។',
    'Show or hide Reader panels from View':
        'បង្ហាញ ឬលាក់ផ្ទាំងអ្នកអានពីម៉ឺនុយ មើល',
    'Use View > Widgets to check or uncheck Bible and Notes, Bibles, Bible Notes, Bible Lookup, and study panes.':
        'ប្រើ មើល > ធាតុក្រាហ្វិក ដើម្បីបង្ហាញ ឬលាក់ ព្រះគម្ពីរ និងកំណត់ត្រា ព្រះគម្ពីរ កំណត់ត្រាព្រះគម្ពីរ ការស្វែងរក និងផ្ទាំងសិក្សា។',
    'Restore every Reader panel layout': 'ស្ដារប្លង់ផ្ទាំងអ្នកអានទាំងអស់',
    'Use View > Reset Widgets Size to restore defaults and reopen collapsed panels after confirmation.':
        'ប្រើ មើល > កំណត់ទំហំធាតុក្រាហ្វិកឡើងវិញ ដើម្បីស្ដារលំនាំដើម និងបើកផ្ទាំងដែលបានបង្រួម បន្ទាប់ពីបញ្ជាក់។',
    // --- Foreground media widgets and the blend-mode picker (2026-09-24).
    // The blend names are the compositing senses: `Screen Blend` rather than
    // `Screen`, which is the projector, and `Value` for CSS `luminosity`.
    'Video Show': 'បង្ហាញវីដេអូ',
    'Image Show': 'បង្ហាញរូបភាព',
    'Hide Video': 'លាក់វីដេអូ',
    'Hide Image': 'លាក់រូបភាព',
    'Clear FG Video Show': 'សម្អាតការបង្ហាញវីដេអូខាងមុខ',
    'Clear FG Image Show': 'សម្អាតការបង្ហាញរូបភាពខាងមុខ',
    'Foreground Videos': 'វីដេអូខាងមុខ',
    'Foreground Images': 'រូបភាពខាងមុខ',
    'Blend Mode': 'របៀបលាយ',
    'Blends this box with the items under it':
        'លាយប្រអប់នេះជាមួយធាតុនៅខាងក្រោម',
    Darker: 'ងងឹតជាង',
    Darken: 'ធ្វើឱ្យងងឹត',
    Multiply: 'គុណ',
    'Color Burn': 'ដុតពណ៌',
    Brighter: 'ភ្លឺជាង',
    Lighten: 'ធ្វើឱ្យភ្លឺ',
    'Screen Blend': 'លាយបែបស្គ្រីន',
    'Color Dodge': 'បំភ្លឺពណ៌',
    Add: 'បូក',
    'Stronger Contrast': 'កម្រិតពណ៌ខ្លាំងជាង',
    Overlay: 'ត្រួតលើ',
    'Soft Light': 'ពន្លឺទន់',
    'Hard Light': 'ពន្លឺរឹង',
    Compare: 'ប្រៀបធៀប',
    Difference: 'ភាពខុសគ្នា',
    Exclusion: 'ការដកចេញ',
    'Color Parts': 'ផ្នែកនៃពណ៌',
    Hue: 'ពណ៌លាំៗ',
    Saturation: 'ភាពតិត្ថិភាព',
    Value: 'តម្លៃពន្លឺ',
    // --- Canvas item shadow (2026-09-25): a box shadow is the shadow of the
    // RECTANGLE, a drop shadow the shadow of what is painted -- the letters of
    // a box with no backing, or a picture with a see-through edge.
    'No Shadow': 'គ្មានស្រមោល',
    'Box Shadow': 'ស្រមោលប្រអប់',
    'Drop Shadow': 'ស្រមោលតាមរូបរាង',
    'A box shadow follows the box, a drop shadow the letters or picture':
        'ស្រមោលប្រអប់ដើរតាមប្រអប់ ស្រមោលតាមរូបរាងដើរតាមអក្សរ ឬរូបភាព',
    'Shadow Offset X': 'ចម្ងាយស្រមោល X',
    'Shadow Offset Y': 'ចម្ងាយស្រមោល Y',
    'Shadow Blur': 'ភាពព្រិលនៃស្រមោល',
    'Blur:': 'ព្រិល៖',
    // --- Foreground media sessions: one saved set-up (folder, Properties,
    // slide show) per session, several per widget.
    Session: 'វគ្គ',
    'Add Session': 'បន្ថែមវគ្គ',
    'Please stop the audio before switching session.':
        'សូមបញ្ចប់សំឡេង មុននឹងប្តូរវគ្គ។',
    'Rename Session': 'ប្តូរឈ្មោះវគ្គ',
    'Remove Session': 'លុបវគ្គ',
    'Always on Top': 'នៅលើគេជានិច្ច',
    'Z-Index': 'លំដាប់ស្រទាប់',
    'Behind Slide': 'នៅពីក្រោយស្លាយ',
    'Show behind the slide and the Bible text, over the background':
        'បង្ហាញនៅពីក្រោយស្លាយ និងអត្ថបទព្រះគម្ពីរ ពីលើផ្ទៃខាងក្រោយ',
    'Always on Top does not apply while it is behind the slide':
        'នៅលើគេជានិច្ច មិនអនុវត្តទេ ពេលវានៅពីក្រោយស្លាយ',
    'Slide show is running': 'ការបង្ហាញស្លាយកំពុងដំណើរការ',
    'Slide Show': 'ការបង្ហាញស្លាយ',
    'Start Slide Show': 'ចាប់ផ្តើមការបង្ហាញស្លាយ',
    'Stop Slide Show': 'បញ្ឈប់ការបង្ហាញស្លាយ',
    'Slide Show Options': 'ជម្រើសការបង្ហាញស្លាយ',
    'Close Slide Show Options': 'បិទជម្រើសការបង្ហាញស្លាយ',
    'Repeat All': 'ធ្វើម្តងទៀតទាំងអស់',
    'Jumping Step': 'ចំនួនលោតម្តង',
    Step: 'ជំហាន',
    'Random Up To': 'ចៃដន្យរឫូតដល់',
    'Random Up To Seconds': 'ចៃដន្យរឫូតដល់វិនាទី',
    'A New Wait Is Drawn For Each Slide':
        'ចៃដន្យពេលរង់ចាំថ្មីសម្រាប់ស្លាយនីមួយៗ',
    'The Wait Drawn For This Slide': 'ពេលរង់ចាំដែលចៃដន្យសម្រាប់ស្លាយនេះ',
    'Wait Until The Video Ends': 'រង់ចាំរឫូតដល់វីដេអូចប់',
    'Next When The Video Ends': 'បន្ទាប់នៅពេលវីដេអូចប់',
    'How Long This Video Runs': 'រយៈពេលរបស់វីដេអូនេះ',
    'Next In': 'បន្ទាប់ក្នុងរយៈពេល',
    'Play With Sound': 'ចាក់ជាមួយសំលេង',
    'Hide Slide Show Controls': 'លាក់ប៊ូតុងបញ្ជាការបង្ហាញស្លាយ',
    'On Screen': 'លើអេក្រង់',
    // --- Foreground properties: the 3x3 position pad replaces two rows of
    // align buttons, so each cell needs a name of its own.
    'Top left': 'ឆ្វេងខាងលើ',
    'Top center': 'កណ្តាលខាងលើ',
    'Top right': 'ស្តាំខាងលើ',
    'Middle left': 'ឆ្វេងកណ្តាល',
    'Middle center': 'កណ្តាលពិត',
    'Middle right': 'ស្តាំកណ្តាល',
    'Bottom left': 'ឆ្វេងខាងក្រោម',
    'Bottom center': 'កណ្តាលខាងក្រោម',
    'Bottom right': 'ស្តាំខាងក្រោម',
    Position: 'ទីតាំង',
    Round: 'ជ្រុងមូល',
    'No Transition': 'គ្មានការផ្លាស់ប្តូរ',
    Fade: 'រសាត់',
    'Slide In': 'រុញចូល',
    // --- Foreground Effects: the frame, the shadow, the room around the
    // words and how they are set. One fold under the Properties rows.
    Effects: 'ការតុបតែង',
    Border: 'ស៊ុម',
    'Border Width': 'កម្រាស់ស៊ុម',
    'Border Color': 'ពណ៌ស៊ុម',
    'Shadow Color': 'ពណ៌ស្រមោល',
    Padding: 'ចន្លោះខាងក្នុង',
    'Space inside the box, in text sizes': 'ចន្លោះខាងក្នុងប្រអប់ តាមទំហំអក្សរ',
    'Text Align': 'ការតម្រឹមអក្សរ',
    'Line Height': 'កម្ពស់ជួរ',
    '0 keeps the screen line spacing': '0 រក្សាចន្លោះជួរដើមរបស់អេក្រង់',
    'Letter Spacing': 'ចន្លោះតួអក្សរ',
    'Text Shadow Color': 'ពណ៌ស្រមោលអក្សរ',
    'Makes words readable over a picture or a video':
        'ធ្វើឱ្យអក្សរអានបានច្បាស់លើរូបភាព ឬវីដេអូ',
    'Text Style': 'រចនាបថអក្សរ',
    Italic: 'អក្សរទ្រេត',
    Underline: 'គូសបន្ទាត់ក្រោម',
    Uppercase: 'អក្សរធំ',
    None: 'គ្មាន',
    Solid: 'បន្ទាត់ពេញ',
    Dashed: 'បន្ទាត់ដាច់ៗ',
    Dotted: 'បន្ទាត់ចុចៗ',
    Double: 'បន្ទាត់ទ្វេ',
    Soft: 'ស្រាល',
    Medium: 'មធ្យម',
    Strong: 'ខ្លាំង',
    Glow: 'ពន្លឺរស្មី',
    Outline: 'គែមអក្សរ',
    // Help -> Keyboard Shortcuts (src/keyboard-shortcut).
    'Keyboard Shortcuts': 'ផ្លូវកាត់ក្ដារចុច',
    'Search shortcuts': 'ស្វែងរកផ្លូវកាត់',
    'No shortcuts found': 'រកមិនឃើញផ្លូវកាត់ទេ',
    'Start or stop Presenting Control':
        'ចាប់ផ្ដើម ឬបញ្ឈប់ការគ្រប់គ្រងការបង្ហាញ',
    'Every window': 'គ្រប់ផ្ទាំងវីនដូ',
    'Dialogs and menus': 'ប្រអប់ និងម៉ឺនុយ',
    'Confirm the dialog': 'យល់ព្រមលើប្រអប់',
    'Cancel the dialog': 'បោះបង់ប្រអប់',
    'Move through the right-click menu': 'ផ្លាស់ទីក្នុងម៉ឺនុយចុចស្ដាំ',
    'Choose the highlighted menu item': 'ជ្រើសធាតុម៉ឺនុយដែលបានរំលេច',
    'Jump to a menu item by its first letter': 'លោតទៅធាតុម៉ឺនុយតាមអក្សរដំបូង',
    Screens: 'អេក្រង់បង្ហាញ',
    'Show or hide the selected screens': 'បង្ហាញ ឬលាក់អេក្រង់ដែលបានជ្រើស',
    'Show or take down Messages': 'បង្ហាញ ឬដកសារចេញ',
    'While the Messages panel is open': 'ពេលផ្ទាំងសារកំពុងបើក',
    'Next slide': 'ស្លាយបន្ទាប់',
    'Previous slide': 'ស្លាយមុន',
    'Select all slides': 'ជ្រើសរើសស្លាយទាំងអស់',
    'Copy the selected slides': 'ចម្លងស្លាយដែលបានជ្រើស',
    'Paste slides': 'បិទភ្ជាប់ស្លាយ',
    'Duplicate the selected slides': 'ស្ទួនស្លាយដែលបានជ្រើស',
    'Delete the selected slides': 'លុបស្លាយដែលបានជ្រើស',
    'Clear the slide selection': 'បោះបង់ការជ្រើសស្លាយ',
    'While the slides panel has focus': 'ពេលផ្ទាំងស្លាយកំពុងសកម្ម',
    'While a Presenting Flow preview has focus':
        'ពេលផ្ទាំងមើលតារាងកម្មវិធីកំពុងសកម្ម',
    'Go to the next item': 'ទៅធាតុបន្ទាប់',
    'While the current part of Long Text Show has focus':
        'ពេលផ្នែកបច្ចុប្បន្ននៃការបង្ហាញអត្ថបទវែងកំពុងសកម្ម',
    'Bring the next part to the middle': 'នាំផ្នែកបន្ទាប់មកកណ្តាលអេក្រង់',
    'Bring the previous part to the middle': 'នាំផ្នែកមុនមកកណ្តាលអេក្រង់',
    'Take the keys back to what is being presented':
        'ប្រគល់គ្រាប់ចុចត្រឡប់ទៅអ្វីដែលកំពុងបង្ហាញ',
    'Pressed 3 times quickly while another part of the app has focus':
        'ចុច ៣ ដងយ៉ាងរហ័ស ពេលផ្នែកផ្សេងនៃកម្មវិធីកំពុងសកម្ម',
    "While a mini screen's Drawing panel has focus":
        'ពេលផ្ទាំងគូររបស់អេក្រង់តូចកំពុងសកម្ម',
    'Back to painting': 'ត្រឡប់ទៅគូរវិញ',
    "While a mini screen's Focusing panel has focus":
        'ពេលផ្ទាំងផ្តោតរបស់អេក្រង់តូចកំពុងសកម្ម',
    'While Presenting Control is open': 'ពេលការគ្រប់គ្រងការបង្ហាញកំពុងបើក',
    'Back to using the app': 'ត្រឡប់ទៅប្រើកម្មវិធីវិញ',
    'While a drawing tool is in use': 'ពេលកំពុងប្រើឧបករណ៍គូរ',
    'Close the Bible Lookup popup': 'បិទផ្ទាំងស្វែងរកព្រះគម្ពីរ',
    'Open the typed reference': 'បើកវគ្គដែលបានវាយ',
    'Complete the typed reference': 'បំពេញវគ្គដែលបានវាយ',
    'Remove the last part of the reference': 'លុបផ្នែកចុងក្រោយនៃវគ្គ',
    'Clear the reference': 'សម្អាតវគ្គ',
    'Move through the books and chapters': 'ផ្លាស់ទីក្នុងគម្ពីរ និងជំពូក',
    'Move between split passages': 'ផ្លាស់ទីរវាងវគ្គដែលបានបំបែក',
    'Close the selected split passage': 'បិទវគ្គបំបែកដែលបានជ្រើស',
    'Focus the slide canvas': 'ផ្ដោតលើផ្ទាំងក្រណាត់ស្លាយ',
    'While the slide canvas has focus': 'ពេលផ្ទាំងក្រណាត់ស្លាយកំពុងសកម្ម',
    'Deselect the boxes': 'បោះបង់ការជ្រើសប្រអប់',
    'Select the next box': 'ជ្រើសប្រអប់បន្ទាប់',
    'Select the previous box': 'ជ្រើសប្រអប់មុន',
    'Move the selected box': 'ផ្លាស់ទីប្រអប់ដែលបានជ្រើស',
    'Hold Shift to move further, Ctrl to move less':
        'សង្កត់ Shift ដើម្បីផ្លាស់ទីឆ្ងាយជាង ឬ Ctrl ដើម្បីផ្លាស់ទីតិចជាង',
    'Copy the selected boxes': 'ចម្លងប្រអប់ដែលបានជ្រើស',
    'Paste boxes or a copied Bible passage':
        'បិទភ្ជាប់ប្រអប់ ឬវគ្គព្រះគម្ពីរដែលបានចម្លង',
    'Duplicate the selected boxes': 'ស្ទួនប្រអប់ដែលបានជ្រើស',
    'Delete the selected boxes': 'លុបប្រអប់ដែលបានជ្រើស',
    'Finish editing the text': 'បញ្ចប់ការកែអត្ថបទ',
    'While typing in a text box': 'ពេលកំពុងវាយក្នុងប្រអប់អត្ថបទ',
    'Cancel editing the text': 'បោះបង់ការកែអត្ថបទ',
    'While the Bible Lookup is open': 'ពេលផ្ទាំងស្វែងរកព្រះគម្ពីរកំពុងបើក',
    'Screen not shown': 'អេក្រង់មិនបានបង្ហាញ',
    'Its Screen Mirror display is not connected. Connect that computer, or choose another display for this screen.':
        'ម៉ូនីទ័រការឆ្លុះអេក្រង់របស់វាមិនបានភ្ជាប់ទេ។ សូមភ្ជាប់កុំព្យូទ័រនោះ ឬជ្រើសរើសម៉ូនីទ័រផ្សេងសម្រាប់អេក្រង់នេះ។',
    'Failed to load the font list': 'មិនអាចផ្ទុកបញ្ជីពុម្ពអក្សរបានទេ',
    'Guest display, not connected': 'ម៉ូនីទ័រភ្ញៀវ មិនបានភ្ជាប់',
    'Not connected': 'មិនបានភ្ជាប់',
    'Primary display': 'ម៉ូនីទ័រចម្បង',
    'Unnamed display': 'ម៉ូនីទ័រគ្មានឈ្មោះ',
    Assistant: 'ជំនួយការ',
    'clicked something': 'បានចុចអ្វីមួយ',
    'dragged something': 'បានអូសអ្វីមួយ',
    'filled in a box': 'បានបំពេញប្រអប់មួយ',
    'filled in a form': 'បានបំពេញទម្រង់មួយ',
    'pointed at something': 'បានចង្អុលទៅអ្វីមួយ',
    'pressed a key': 'បានចុចគ្រាប់ចុចមួយ',
    'typed something': 'បានវាយអ្វីមួយ',
    'chose a file': 'បានជ្រើសរើសឯកសារមួយ',
    'answered a message box': 'បានឆ្លើយប្រអប់សារមួយ',
    'opened another page': 'បានបើកទំព័រផ្សេង',
    'opened a window': 'បានបើកបង្អួចមួយ',
    'closed a window': 'បានបិទបង្អួចមួយ',
    'resized the window': 'បានប្ដូរទំហំបង្អួច',
    'changed how the page is shown': 'បានប្ដូររបៀបបង្ហាញទំព័រ',
    'ran something in the page': 'បានដំណើរការអ្វីមួយក្នុងទំព័រ',
    'took content off a screen': 'បានដកមាតិកាចេញពីអេក្រង់',
    'started a walkthrough': 'បានចាប់ផ្ដើមការណែនាំ',
    'moved the walkthrough on': 'បានបន្តការណែនាំទៅជំហានបន្ទាប់',
    'pointed out a control': 'បានចង្អុលបង្ហាញប៊ូតុងមួយ',
    'switched the window to another page': 'បានប្ដូរបង្អួចទៅទំព័រផ្សេង',
    'asked you to point at a control': 'បានសុំឱ្យអ្នកចង្អុលទៅប៊ូតុងមួយ',
    'read a website': 'បានអានគេហទំព័រមួយ',
    'changed a song': 'បានកែប្រែចំរៀងមួយ',
    'changed a slide document': 'បានកែប្រែឯកសារស្លាយមួយ',
    'put a Bible passage on the screen': 'បានដាក់វគ្គព្រះគម្ពីរលើអេក្រង់',
    'opened a verse in the Bible Lookup':
        'បានបើកខគម្ពីរមួយក្នុងការស្វែងរកព្រះគម្ពីរ',
    'put a countdown or a message on the screen':
        'បានដាក់ការរាប់ថយក្រោយ ឬសារលើអេក្រង់',
    'changed the saved Bible passages': 'បានកែប្រែវគ្គព្រះគម្ពីរដែលបានរក្សាទុក',
    'changed a Bible note': 'បានកែប្រែកំណត់ត្រាព្រះគម្ពីរមួយ',
    'put back an earlier change': 'បានត្រឡប់ការផ្លាស់ប្ដូរមុនវិញ',
    'chose a menu item': 'បានជ្រើសរើសធាតុម៉ឺនុយមួយ',
    'scrolled a list': 'បានរំកិលបញ្ជីមួយ',
    'changed a media file': 'បានកែប្រែឯកសារមេឌៀមួយ',
    'put a song back as saved': 'បានដាក់ចំរៀងមួយត្រឡប់ទៅសភាពដែលបានរក្សាទុក',
    'put a slide document back as saved':
        'បានដាក់ឯកសារស្លាយមួយត្រឡប់ទៅសភាពដែលបានរក្សាទុក',
    'made a web page': 'បានបង្កើតទំព័រវេបមួយ',
    'changed a web page': 'បានកែប្រែទំព័រវេបមួយ',
    'renamed a media file': 'បានកែឈ្មោះឯកសារមេឌៀមួយ',
    'moved a media file to the trash': 'បានផ្លាស់ទីឯកសារមេឌៀមួយទៅធុងសំរាម',
    'imported a media file from the disk': 'បាននាំចូលឯកសារមេឌៀមួយពីថាស',
    'changed a run sheet': 'បានកែប្រែតារាងកម្មវិធីមួយ',
    'made a run sheet': 'បានបង្កើតតារាងកម្មវិធីមួយ',
    'renamed a run sheet': 'បានកែឈ្មោះតារាងកម្មវិធីមួយ',
    'moved a run sheet to the trash': 'បានផ្លាស់ទីតារាងកម្មវិធីមួយទៅធុងសំរាម',
    'added a line to a run sheet': 'បានបន្ថែមធាតុមួយទៅតារាងកម្មវិធី',
    'removed a line from a run sheet': 'បានដកធាតុមួយចេញពីតារាងកម្មវិធី',
    'moved a line in a run sheet': 'បានផ្លាស់ទីធាតុមួយក្នុងតារាងកម្មវិធី',
    'copied a line in a run sheet': 'បានចម្លងធាតុមួយក្នុងតារាងកម្មវិធី',
    'parked a line in a run sheet': 'បានបិទដំណើរការធាតុមួយក្នុងតារាងកម្មវិធី',
    'put a line of a run sheet back in play':
        'បានបើកដំណើរការធាតុមួយក្នុងតារាងកម្មវិធីវិញ',
    'started a countdown on the screen': 'បានចាប់ផ្ដើមរាប់ថយក្រោយលើអេក្រង់',
    'started a stopwatch on the screen': 'បានចាប់ផ្ដើមនាឡិកាបញ្ឈប់លើអេក្រង់',
    'put a clock on the screen': 'បានដាក់នាឡិកាលើអេក្រង់',
    'put a scrolling message on the screen': 'បានដាក់អក្សររត់លើអេក្រង់',
    'put a line of text on the screen': 'បានដាក់អត្ថបទមួយបន្ទាត់លើអេក្រង់',
    'took a foreground extra off the screen': 'បានដកធាតុផ្ទៃខាងមុខចេញពីអេក្រង់',
    'took every foreground extra off the screen':
        'បានដកធាតុផ្ទៃខាងមុខទាំងអស់ចេញពីអេក្រង់',
    'made a song': 'បានបង្កើតចំរៀងមួយ',
    'made a slide document': 'បានបង្កើតឯកសារស្លាយមួយ',
    'renamed a song': 'បានកែឈ្មោះចំរៀងមួយ',
    'renamed a slide document': 'បានកែឈ្មោះឯកសារស្លាយមួយ',
    'moved a song to the trash': 'បានផ្លាស់ទីចំរៀងមួយទៅធុងសំរាម',
    'moved a slide document to the trash': 'បានផ្លាស់ទីឯកសារស្លាយមួយទៅធុងសំរាម',
    'added a slide': 'បានបន្ថែមស្លាយមួយ',
    'changed a slide': 'បានកែប្រែស្លាយមួយ',
    'removed a slide': 'បានដកស្លាយមួយចេញ',
    'moved a slide': 'បានផ្លាស់ទីស្លាយមួយ',
    'copied a slide': 'បានចម្លងស្លាយមួយ',
    'saved a Bible passage': 'បានរក្សាទុកវគ្គព្រះគម្ពីរមួយ',
    'changed a saved Bible passage': 'បានកែប្រែវគ្គព្រះគម្ពីរដែលបានរក្សាទុកមួយ',
    'removed a saved Bible passage': 'បានដកវគ្គព្រះគម្ពីរដែលបានរក្សាទុកមួយចេញ',
    'made a Bibles list': 'បានបង្កើតបញ្ជីព្រះគម្ពីរមួយ',
    'renamed a Bibles list': 'បានកែឈ្មោះបញ្ជីព្រះគម្ពីរមួយ',
    'moved a Bibles list to the trash':
        'បានផ្លាស់ទីបញ្ជីព្រះគម្ពីរមួយទៅធុងសំរាម',
    'added a Bible note': 'បានបន្ថែមកំណត់ត្រាព្រះគម្ពីរមួយ',
    'removed a Bible note': 'បានដកកំណត់ត្រាព្រះគម្ពីរមួយចេញ',
    'made a notes file': 'បានបង្កើតឯកសារកំណត់ត្រាមួយ',
    'renamed a notes file': 'បានកែឈ្មោះឯកសារកំណត់ត្រាមួយ',
    'moved a notes file to the trash': 'បានផ្លាស់ទីឯកសារកំណត់ត្រាមួយទៅធុងសំរាម',
    // --- Bible Properties, redesigned (2026-10-11): a stage, the looks as
    // pictures, and one row per value. `Aa` is the two letters a look is shown
    // on, in the script this window is read in.
    'For God so loved the world, that he gave his only begotten Son':
        'ដ្បិតព្រះទ្រង់ស្រឡាញ់មនុស្សលោក ដល់ម៉្លេះបានជាទ្រង់ប្រទានព្រះរាជបុត្រាទ្រង់តែ១',
    'Light words for a dark background': 'អក្សរភ្លឺ សម្រាប់ផ្ទៃខាងក្រោយងងឹត',
    'Dark words for a light background': 'អក្សរងងឹត សម្រាប់ផ្ទៃខាងក្រោយភ្លឺ',
    Aa: 'កខ',
    'Thin Outline': 'គែមស្ដើង',
    'Heavy Outline': 'គែមក្រាស់',
    'Soft Shadow': 'ស្រមោលស្រាល',
    'Deep Shadow': 'ស្រមោលជ្រៅ',
    'Hard Shadow': 'ស្រមោលច្បាស់',
    Lifted: 'លេចឡើង',
    Haze: 'អ័ព្ទ',
    Halo: 'រង្វង់រស្មី',
    'Blue Edge': 'គែមខៀវ',
    Bold: 'អក្សរដិត',
    Justify: 'តម្រឹមសងខាង',
    'Outline Color': 'ពណ៌គែមអក្សរ',
    'Glow Color': 'ពណ៌ពន្លឺរស្មី',
    'A CSS text-shadow of your own': 'CSS text-shadow ផ្ទាល់ខ្លួនរបស់អ្នក',
    'Plain words again; the size stays': 'ត្រឡប់ទៅអក្សរធម្មតាវិញ ទំហំនៅដដែល',
    // A look somebody made can be kept as a tile of its own.
    Preset: 'គំរូ',
    'Save as Preset': 'រក្សាទុកជាគំរូ',
    'Rename Preset': 'ប្តូរឈ្មោះគំរូ',
    'Replace with Current Look': 'ជំនួសដោយរូបរាងបច្ចុប្បន្ន',
    'Remove Preset': 'លុបគំរូ',
    'Remove a preset to save a new one': 'លុបគំរូមួយចេញ ដើម្បីរក្សាទុកគំរូថ្មី',
    // The walkthrough card's own words (`listGuideCardTranKeys` in
    // tools/owa-devtools-mcp/guide.mjs): it sits in the app window, so it
    // speaks the app's language. `Step` is a slider's step elsewhere.
    Done: 'រួចរាល់',
    'Do it': 'ធ្វើឲ្យខ្ញុំ',
    Skip: 'រំលង',
    'Step by step': 'ម្តងមួយជំហាន',
    'Walkthrough step': 'ជំហាន',
    // The help window's own words (src/chatbot/, `chatTranHelpers.ts`).
    '{title} — the last read failed: {error}':
        '{title} — ការអានលើកចុងក្រោយបរាជ័យ៖ {error}',
    '{title} — {count} shared': '{title} — មាន {count} ដែលបានចែករំលែក',
    '{title} — {count} shared, read at {time}':
        '{title} — មាន {count} ដែលបានចែករំលែក អាននៅម៉ោង {time}',
    'my screen': 'អេក្រង់របស់ខ្ញុំ',
    'app screen': 'អេក្រង់កម្មវិធី',
    'my {window} window': 'វីនដូ {window} របស់ខ្ញុំ',
    'Fetching the list…': 'កំពុងទាញយកបញ្ជី…',
    'The full list is not available right now — the four above still work, and so does anything you type.':
        'បញ្ជីពេញលេញមិនអាចប្រើបាននៅពេលនេះទេ — សំណួរទាំងបួនខាងលើនៅតែប្រើបាន ហើយអ្វីដែលអ្នកវាយបញ្ចូលក៏ប្រើបានដែរ។',
    '{count} questions it is ready for here. Type a few words in the box to narrow them down.':
        'មានសំណួរ {count} ដែលវាអាចឆ្លើយនៅទីនេះ។ វាយពាក្យពីរបីក្នុងប្រអប់ ដើម្បីបង្រួមបញ្ជី។',
    'No AI model or account needed. Press one, then use {button} in the Reader for one safe step at a time.':
        'មិនត្រូវការម៉ូដែល AI ឬគណនីទេ។ ចុចមួយ រួចប្រើ {button} ក្នុងទំព័រអានព្រះគម្ពីរ ដើម្បីធ្វើម្ដងមួយជំហានដោយសុវត្ថិភាព។',
    'Try a guided demo': 'សាកល្បងការបង្ហាញណែនាំ',
    'Opens {address} in your browser':
        'បើក {address} ក្នុងកម្មវិធីរុករករបស់អ្នក',
    'Spending limit per hour': 'ដែនកំណត់ការចំណាយក្នុងមួយម៉ោង',
    'Lift the pause and start the hour again: the whole limit is available once more from now.':
        'បិទការផ្អាក ហើយចាប់ផ្ដើមម៉ោងឡើងវិញ៖ ចាប់ពីពេលនេះ អ្នកអាចប្រើដែនកំណត់ទាំងមូលម្ដងទៀត។',
    'Which part of the app': 'ផ្នែកណាមួយនៃកម្មវិធី',
    'Which window of the app you are asking about. It starts on the window you launch it from; your choice stays until the next launch.':
        'វីនដូណាមួយនៃកម្មវិធីដែលអ្នកកំពុងសួរអំពី។ វាចាប់ផ្ដើមនៅវីនដូដែលអ្នកបើកវាពី ហើយជម្រើសរបស់អ្នកនៅដដែល រហូតដល់ការបើកលើកក្រោយ។',
    'Working in': 'កំពុងធ្វើការក្នុង',
    'Which window': 'វីនដូណា',
    'Which of the open windows of the app the help looks at and works in: it reads that window, outlines buttons in it, and the 📷 and ◎ beside the box work there. The main window unless you choose another.':
        'វីនដូណាមួយដែលកំពុងបើកនៃកម្មវិធី ដែលជំនួយការមើល និងធ្វើការនៅក្នុងនោះ៖ វាអានវីនដូនោះ គូសបញ្ជាក់ប៊ូតុងក្នុងវា ហើយ 📷 និង ◎ នៅក្បែរប្រអប់ក៏ធ្វើការនៅទីនោះដែរ។ គឺវីនដូមេ លុះត្រាតែអ្នកជ្រើសវីនដូផ្សេង។',
    '— no key needed, shared public service':
        '— មិនត្រូវការ API key ទេ ជាសេវាសាធារណៈប្រើរួមគ្នា',
    '{name} — needs an API key': '{name} — ត្រូវការ API key',
    '{names} and {last}': '{names} និង {last}',
    'Which assistant answers': 'ជំនួយការណាដែលឆ្លើយ',
    '{names} need an API key of your own — add one in Settings → AI Providers':
        '{names} ត្រូវការ API key ផ្ទាល់ខ្លួនរបស់អ្នក — បន្ថែមវានៅក្នុង ការកំណត់ → អ្នកផ្តល់សេវា AI',
    '{name} answers your questions here': '{name} ឆ្លើយសំណួររបស់អ្នកនៅទីនេះ',
    'No AI key': 'គ្មាន API key សម្រាប់ AI',
    '{name} answered the last question.': '{name} បានឆ្លើយសំណួរចុងក្រោយ។',
    'Read the whole notice': 'អានសេចក្ដីជូនដំណឹងទាំងមូល',
    'Fold this notice': 'បង្រួមសេចក្ដីជូនដំណឹងនេះ',
    Fold: 'បង្រួម',
    'Who answers:': 'អ្នកឆ្លើយ៖',
    'Open {address}': 'បើក {address}',
    'Which model answers': 'ម៉ូដែលណាដែលឆ្លើយ',
    'Loading…': 'កំពុងផ្ទុក…',
    'More models…': 'ម៉ូដែលច្រើនទៀត…',
    '(main window, {window})': '(វីនដូមេ, {window})',
    '({window} window)': '(វីនដូ {window})',
    '{name} — not attached any more': '{name} — លែងបានភ្ជាប់ទៀតហើយ',
    '{name} — press to ring it in the app':
        '{name} — ចុចដើម្បីគូសរង្វង់វាក្នុងកម្មវិធី',
    '{name} — press to see it bigger': '{name} — ចុចដើម្បីមើលវាឱ្យធំ',
    '{name} — press to open it': '{name} — ចុចដើម្បីបើកវា',
    'Remove {name}': 'ដក {name} ចេញ',
    'This window cannot show this kind of file. Download it or open its folder to look at it.':
        'វីនដូនេះមិនអាចបង្ហាញឯកសារប្រភេទនេះបានទេ។ សូមទាញយកវា ឬបើកថតរបស់វា ដើម្បីមើល។',
    'Copy this answer': 'ចម្លងចម្លើយនេះ',
    'Could not copy': 'មិនអាចចម្លងបានទេ',
    'Copy {name} to the clipboard': 'ចម្លង {name} ទៅក្ដារតម្បៀតខ្ទាស់',
    'Could not copy the picture': 'មិនអាចចម្លងរូបភាពបានទេ',
    'Copy the picture to the clipboard': 'ចម្លងរូបភាពទៅក្ដារតម្បៀតខ្ទាស់',
    'The song text, as it will be saved':
        'អត្ថបទចម្រៀង ដូចដែលវានឹងត្រូវរក្សាទុក',
    'The song text that would be saved': 'អត្ថបទចម្រៀងដែលនឹងត្រូវរក្សាទុក',
    You: 'អ្នក',
    'Put this question back in the box': 'ដាក់សំណួរនេះត្រឡប់ទៅក្នុងប្រអប់វិញ',
    'Ask again': 'សួរម្ដងទៀត',
    'This answer helped': 'ចម្លើយនេះបានជួយ',
    'Good answer': 'ចម្លើយល្អ',
    'This answer was wrong or did not help': 'ចម្លើយនេះខុស ឬមិនបានជួយ',
    'Bad answer': 'ចម្លើយមិនល្អ',
    'Looking it up… press Stop to give up on it.':
        'កំពុងស្វែងរក… ចុច បញ្ឈប់ ដើម្បីបោះបង់។',
    '{count} earlier step': '{count} ជំហានមុន',
    '{count} earlier steps': '{count} ជំហានមុនៗ',
    'press Stop to give up on it.': 'ចុច បញ្ឈប់ ដើម្បីបោះបង់។',
    'Show me another thing this window can do':
        'បង្ហាញខ្ញុំពីអ្វីផ្សេងទៀតដែលវីនដូនេះអាចធ្វើបាន',
    'Tip: {tip} Press for another tip.':
        'គន្លឹះ៖ {tip} ចុចដើម្បីមើលគន្លឹះមួយទៀត។',
    'The tip before this one': 'គន្លឹះមុននេះ',
    'Previous tip': 'គន្លឹះមុន',
    'The next tip': 'គន្លឹះបន្ទាប់ទៀត',
    'Hide tips for 30 days': 'លាក់គន្លឹះរយៈពេល ៣០ ថ្ងៃ',
    '{name} could not answer — {reason}.':
        '{name} មិនអាចឆ្លើយបានទេ — {reason}។',
    'I wrote the song out myself instead.':
        'ខ្ញុំបានសរសេរចម្រៀងនេះដោយខ្លួនឯងជំនួសវិញ។',
    "Here is what the app's own guide says.":
        'នេះជាអ្វីដែលសៀវភៅណែនាំរបស់កម្មវិធីនិយាយ។',
    'Putting your words into English with {model}':
        'កំពុងបកប្រែពាក្យរបស់អ្នកជាភាសាអង់គ្លេសដោយប្រើ {model}',
    'The other models could not be listed — {reason}':
        'មិនអាចបង្ហាញបញ្ជីម៉ូដែលផ្សេងទៀតបានទេ — {reason}',
    'I cannot read {names} — try a picture of it instead.':
        'ខ្ញុំមិនអាចអាន {names} បានទេ — សូមសាកល្បងផ្ញើរូបភាពរបស់វាជំនួសវិញ។',
    '{names} is too large to attach — {size} MB at most.':
        '{names} ធំពេក មិនអាចភ្ជាប់បានទេ — យ៉ាងច្រើនបំផុត {size} MB។',
    '{name} is not there any more.': '{name} លែងមាននៅទីនោះទៀតហើយ។',
    'Ask the Assistant About This File': 'សួរជំនួយការអំពីឯកសារនេះ',
    '{name} is attached below. Ask me anything about what is in it, or press a question.':
        '{name} ត្រូវបានភ្ជាប់នៅខាងក្រោម។ សួរខ្ញុំអ្វីក៏បានអំពីខ្លឹមសារក្នុងឯកសារនេះ ឬចុចលើសំណួរមួយ។',
    'This is Bible chapter study material with verse text, cross-references, and explanations arranged by verse.':
        'នេះជាឯកសារសិក្សាជំពូកព្រះគម្ពីរ ដែលមានអត្ថបទខគម្ពីរ ខគម្ពីរយោង និងសេចក្ដីពន្យល់រៀបតាមខនីមួយៗ។',
    'What is this file about?': 'ឯកសារនេះនិយាយអំពីអ្វី?',
    'Sum up the main points': 'សង្ខេបចំណុចសំខាន់ៗ',
    'Explain it in simple words': 'ពន្យល់ដោយពាក្យងាយៗ',
    Read: 'អាន',
    'Full chapter': 'ជំពូកទាំងមូល',
    'Which verses in this chapter do you want to focus on? For example, type 1–3, or choose below.':
        'តើអ្នកចង់ផ្តោតលើខណាខ្លះក្នុងជំពូកនេះ? ឧទាហរណ៍ វាយ 1–3 ឬជ្រើសរើសខាងក្រោម។',
    'Which verse in this chapter do you want to focus on? For example, type 1, or choose below.':
        'តើអ្នកចង់ផ្តោតលើខណាមួយក្នុងជំពូកនេះ? ឧទាហរណ៍ វាយ 1 ឬជ្រើសរើសខាងក្រោម។',
    'This file belongs to the whole book, not to one chapter — like an introduction to it.':
        'ឯកសារនេះសម្រាប់កណ្ឌគម្ពីរទាំងមូល មិនមែនសម្រាប់តែជំពូកមួយទេ — ដូចជាសេចក្ដីផ្ដើមនៃកណ្ឌគម្ពីរនោះ។',
    'You are reading {passage} in the Bible Reader.':
        'អ្នកកំពុងអាន {passage} នៅក្នុងទំព័រអានព្រះគម្ពីរ។',
    'You are reading {passage} in the Bible Reader. Press {range} to read what this file says about it.':
        'អ្នកកំពុងអាន {passage} នៅក្នុងទំព័រអានព្រះគម្ពីរ។ ចុច {range} ដើម្បីអានអ្វីដែលឯកសារនេះនិយាយអំពីខទាំងនោះ។',
    'What does it say about {passage}?':
        'តើឯកសារនេះនិយាយអ្វីខ្លះអំពី {passage}?',
    'Which verse in this chapter do you want to focus on? You are reading {range} — press it, or choose another below.':
        'តើអ្នកចង់ផ្តោតលើខណាមួយក្នុងជំពូកនេះ? អ្នកកំពុងអានខ {range} — ចុចវា ឬជ្រើសរើសខផ្សេងទៀតខាងក្រោម។',
    'AI analysis can make mistakes. Please read the passage, cross-references, and explanation yourself in the original Bible and PDF.':
        'ការវិភាគរបស់ AI អាចមានកំហុស។ សូមអានបទគម្ពីរ ខគម្ពីរយោង និងសេចក្ដីពន្យល់ដោយខ្លួនឯងនៅក្នុងព្រះគម្ពីរ និងឯកសារ PDF ដើម។',
    'I could not read the PDF explanation reliably, so I did not show it. Please check the original PDF yourself or try a model that can read pictures better.':
        'ខ្ញុំមិនអាចអានសេចក្ដីពន្យល់ក្នុង PDF បានដោយទុកចិត្តបានទេ ដូច្នេះខ្ញុំមិនបានបង្ហាញវាទេ។ សូមផ្ទៀងផ្ទាត់ PDF ដើមដោយខ្លួនឯង ឬសាកល្បងម៉ូដែលដែលអាចអានរូបភាពបានប្រសើរជាងនេះ។',
    'This file goes with every question in this tab. Press × when you are done with it.':
        'ឯកសារនេះត្រូវបានផ្ញើទៅជាមួយគ្រប់សំណួរក្នុងផ្ទាំងនេះ។ ចុច × នៅពេលអ្នកលែងត្រូវការវា។',
    'Still asking about': 'កំពុងសួរអំពី',
    'Ask the Assistant About This Person': 'សួរជំនួយការអំពីបុគ្គលនេះ',
    'Ask the Assistant About This Place': 'សួរជំនួយការអំពីទីកន្លែងនេះ',
    'Ask the Assistant About This Passage': 'សួរជំនួយការអំពីបទគម្ពីរនេះ',
    'Ask the Assistant About This Verse': 'សួរជំនួយការអំពីខគម្ពីរនេះ',
    'Open in Chatbot': 'បើកក្នុង Chatbot',
    'More things to do': 'កិច្ចការផ្សេងទៀត',
    'Previous chapter': 'ជំពូកមុន',
    'Next chapter': 'ជំពូកបន្ទាប់',
    'Previous verse': 'ខមុន',
    'Next verse': 'ខបន្ទាប់',
    'Read it in another Bible': 'អានវាក្នុងព្រះគម្ពីរផ្សេង',
    'Who and where is in it': 'មាននរណា និងទីកន្លែងណាខ្លះក្នុងនេះ',
    'Family and places': 'គ្រួសារ និងទីកន្លែង',
    'Related places': 'ទីកន្លែងដែលពាក់ព័ន្ធ',
    'Its verses': 'ខគម្ពីររបស់វា',
    'Family line to Jesus': 'ពូជពង្សដល់ព្រះយេស៊ូវ',
    'Open another passage': 'បើកបទគម្ពីរផ្សេង',
    'Save to my Bibles list': 'រក្សាទុកក្នុងបញ្ជីព្រះគម្ពីររបស់ខ្ញុំ',
    'Copy the passage': 'ចម្លងបទគម្ពីរ',
    'Show it on a map': 'បង្ហាញនៅលើផែនទី',
    'Related verses': 'ខគម្ពីរដែលពាក់ព័ន្ធ',
    'Study files for this chapter': 'ឯកសារសិក្សាសម្រាប់ជំពូកនេះ',
    'Study the words': 'សិក្សាពាក្យនីមួយៗ',
    'All words': 'ពាក្យទាំងអស់',
    'Another verse': 'ខផ្សេងទៀត',
    'Choose a word': 'ជ្រើសរើសពាក្យ',
    'More words': 'ពាក្យបន្ថែមទៀត',
    'I could not read the words of {name} just now.':
        'ឥឡូវនេះ ខ្ញុំមិនអាចអានពាក្យនៃ {name} បានទេ។',
    'Which verse of {name} do you want to study? Press one, and I will list its words.':
        'តើអ្នកចង់សិក្សាខណាមួយនៃ {name}? ចុចលើខមួយ ហើយខ្ញុំនឹងរាយពាក្យរបស់វា។',
    'Press a word to learn it, or {all} to learn every word of the verse.':
        'ចុចលើពាក្យមួយ ដើម្បីរៀនវា ឬចុច {all} ដើម្បីរៀនគ្រប់ពាក្យនៃខនេះ។',
    'Next word: {word}': 'ពាក្យបន្ទាប់៖ {word}',
    'Search Google for {word}': 'ស្វែងរក {word} ក្នុង Google',
    'Teach me every word of {verse}': 'បង្រៀនខ្ញុំគ្រប់ពាក្យនៃ {verse}',
    'Teach me the word {word}': 'បង្រៀនខ្ញុំពីពាក្យ {word}',
    'Teaching a word needs an assistant, and none could answer just now. You can search Google for it, or pick an assistant in the row above and ask again.':
        'ការបង្រៀនពាក្យត្រូវការជំនួយការ ហើយឥឡូវនេះគ្មានជំនួយការណាអាចឆ្លើយបានទេ។ អ្នកអាចស្វែងរកវាក្នុង Google ឬជ្រើសរើសជំនួយការនៅជួរខាងលើ ហើយសួរម្ដងទៀត។',
    'Opened a Google search for {word} in your browser.':
        'បានបើកការស្វែងរក {word} ក្នុង Google នៅក្នុងកម្មវិធីរុករករបស់អ្នក។',
    'Which other verses are related to this passage?':
        'តើមានខគម្ពីរណាផ្សេងទៀតដែលពាក់ព័ន្ធនឹងបទគម្ពីរនេះ?',
    "The app's cross references lead from it to {count} other verses.":
        'ខគម្ពីរយោងរបស់កម្មវិធី នាំពីបទគម្ពីរនេះទៅខគម្ពីរផ្សេងទៀតចំនួន {count}។',
    'Resources has {count} study files for its chapter.':
        'ឯកសារពាក់ព័ន្ធ មានឯកសារសិក្សាចំនួន {count} សម្រាប់ជំពូករបស់វា។',
    'You have notes or marks of your own on {count} of its verses.':
        'អ្នកមានកំណត់ចំណាំ ឬការគូសចំណាំផ្ទាល់ខ្លួន លើខចំនួន {count} នៃបទគម្ពីរនេះ។',
    'What did I note on these verses?': 'តើខ្ញុំបានកត់ចំណាំអ្វីខ្លះលើខទាំងនេះ?',
    "The app's cross references have nothing for {name}.":
        'ខគម្ពីរយោងរបស់កម្មវិធី មិនមានអ្វីសម្រាប់ {name} ទេ។',
    "The app's cross references lead from {name} to {count} other verses. Press one to read it with me.":
        'ខគម្ពីរយោងរបស់កម្មវិធី នាំពី {name} ទៅខគម្ពីរផ្សេងទៀតចំនួន {count}។ ចុចលើមួយ ដើម្បីអានវាជាមួយខ្ញុំ។',
    '{count} of its verses': 'ពី {count} ខ',
    'verses {list}': 'ខ {list}',
    'What most of its verses point to': 'អ្វីដែលខភាគច្រើនរបស់វាចង្អុលទៅ',
    'In the Old Testament': 'ក្នុងគម្ពីរសញ្ញាចាស់',
    'In the New Testament': 'ក្នុងគម្ពីរសញ្ញាថ្មី',
    'In the New Testament, about the chapters around it':
        'ក្នុងគម្ពីរសញ្ញាថ្មី អំពីជំពូកនៅជុំវិញវា',
    'In the Old Testament, about the chapters around it':
        'ក្នុងគម្ពីរសញ្ញាចាស់ អំពីជំពូកនៅជុំវិញវា',
    'Themes, verse by verse': 'ប្រធានបទ តាមខនីមួយៗ',
    'Verse {verse}: {themes}': 'ខ {verse}៖ {themes}',
    'Resources has no study files for the chapter of {name}.':
        'ឯកសារពាក់ព័ន្ធ មិនមានឯកសារសិក្សាសម្រាប់ជំពូករបស់ {name} ទេ។',
    'The study files in Resources for the chapter of {name}. Press one to ask about it.':
        'ឯកសារសិក្សាក្នុង ឯកសារពាក់ព័ន្ធ សម្រាប់ជំពូករបស់ {name}។ ចុចលើមួយ ដើម្បីសួរអំពីវា។',
    'The names lookup has no point on a map for {name}.':
        'ទីកន្លែង-ឈ្មោះ មិនមានចំណុចនៅលើផែនទីសម្រាប់ {name} ទេ។',
    'Opened {name} on a map in your browser.':
        'បានបើក {name} នៅលើផែនទីក្នុងកម្មវិធីរុករករបស់អ្នក។',
    'Press {button} to open {name} on a map in your browser.':
        'ចុច {button} ដើម្បីបើក {name} នៅលើផែនទីក្នុងកម្មវិធីរុករករបស់អ្នក។',
    'Press {name} under the passage above.': 'ចុច {name} នៅក្រោមបទគម្ពីរខាងលើ។',
    'Here is {name} from the Bible it was opened in.':
        'នេះជា {name} ពីព្រះគម្ពីរដែលវាត្រូវបានបើក។',
    'Here is the family line in {passage}, in the order it gives it:':
        'នេះជាពូជពង្សនៅក្នុង {passage} តាមលំដាប់ដែលវាបានរៀបរាប់៖',
    'Here is the family line in {passage}, from the Bible {bible}, in the order it gives it:':
        'នេះជាពូជពង្សនៅក្នុង {passage} ពីព្រះគម្ពីរ {bible} តាមលំដាប់ដែលវាបានរៀបរាប់៖',
    'Neither family line the Bible gives — Matthew 1 and Luke 3 — names {name}.':
        'គ្មានពូជពង្សណាមួយដែលព្រះគម្ពីរបានឲ្យ — ម៉ាថាយ ១ និងលូកា ៣ — មានឈ្មោះ {name} ទេ។',
    'The record names no children of {name}.':
        'កំណត់ត្រានេះមិនមានឈ្មោះកូនរបស់ {name} ទេ។',
    'The record names no husband or wife of {name}.':
        'កំណត់ត្រានេះមិនមានឈ្មោះប្ដី ឬប្រពន្ធរបស់ {name} ទេ។',
    'The record names no brothers or sisters of {name}.':
        'កំណត់ត្រានេះមិនមានឈ្មោះបងប្អូនរបស់ {name} ទេ។',
    'The record names no parents of {name}.':
        'កំណត់ត្រានេះមិនមានឈ្មោះឪពុកម្តាយរបស់ {name} ទេ។',
    'The record names {count} children of {name}: {names}.':
        'កំណត់ត្រានេះមានឈ្មោះកូន {count} នាក់របស់ {name}៖ {names}។',
    'The record names {count} husbands or wives of {name}: {names}.':
        'កំណត់ត្រានេះមានឈ្មោះប្ដី ឬប្រពន្ធ {count} នាក់របស់ {name}៖ {names}។',
    'The record names {count} brothers and sisters of {name}: {names}.':
        'កំណត់ត្រានេះមានឈ្មោះបងប្អូន {count} នាក់របស់ {name}៖ {names}។',
    'The record names {count} parents of {name}: {names}.':
        'កំណត់ត្រានេះមានឈ្មោះឪពុកម្តាយ {count} នាក់របស់ {name}៖ {names}។',
    'The names lookup lists no family or places for {name}.':
        'ទីកន្លែង-ឈ្មោះ មិនមានគ្រួសារ ឬទីកន្លែងសម្រាប់ {name} ទេ។',
    'The family and places of {name}. Press one to ask about it.':
        'គ្រួសារ និងទីកន្លែងរបស់ {name}។ ចុចលើមួយ ដើម្បីសួរអំពីវា។',
    'Places related to {name}. Press one to ask about it.':
        'ទីកន្លែងដែលពាក់ព័ន្ធនឹង {name}។ ចុចលើមួយ ដើម្បីសួរអំពីវា។',
    'The names lookup lists no verses for {name}.':
        'ទីកន្លែង-ឈ្មោះ មិនមានខគម្ពីរសម្រាប់ {name} ទេ។',
    'Verses about {name}. Press one to read it with me.':
        'ខគម្ពីរអំពី {name}។ ចុចលើមួយ ដើម្បីអានវាជាមួយខ្ញុំ។',
    'The names lookup lists {count} verses; these are the first {shown}.':
        'ទីកន្លែង-ឈ្មោះ មានខគម្ពីរ {count}។ នេះជា {shown} ដំបូង។',
    'The names lookup has nobody and no place in {name}.':
        'ទីកន្លែង-ឈ្មោះ មិនមាននរណា ឬទីកន្លែងណាក្នុង {name} ទេ។',
    'People and places in {name}. Press one to ask about it.':
        'មនុស្ស និងទីកន្លែងក្នុង {name}។ ចុចលើមួយ ដើម្បីសួរអំពីវា។',
    'This is the only Bible on this computer.':
        'នេះជាព្រះគម្ពីរតែមួយគត់នៅលើកុំព្យូទ័រនេះ។',
    'Which Bible should I read {name} in?':
        'តើខ្ញុំគួរអាន {name} ក្នុងព្រះគម្ពីរណា?',
    'What would you like to do with {name}?': 'តើអ្នកចង់ធ្វើអ្វីជាមួយ {name}?',
    'I opened {name} in the Bible Lookup.':
        'ខ្ញុំបានបើក {name} ក្នុងការរកមើលព្រះគម្ពីររួចហើយ។',
    'I could not open {name} in the Bible Lookup just now.':
        'ខ្ញុំមិនអាចបើក {name} ក្នុងការរកមើលព្រះគម្ពីរបានទេនៅពេលនេះ។',
    'There is no passage after {name} in this Bible.':
        'គ្មានបទគម្ពីរបន្ទាប់ពី {name} ក្នុងព្រះគម្ពីរនេះទេ។',
    'There is no passage before {name} in this Bible.':
        'គ្មានបទគម្ពីរមុន {name} ក្នុងព្រះគម្ពីរនេះទេ។',
    'Type the passage you want, like John 3:16 or Psalm 23.':
        'សូមវាយបទគម្ពីរដែលអ្នកចង់បាន ដូចជា យ៉ូហាន ៣:១៦ ឬ ទំនុកដំកើង ២៣។',
    'I could not read “{words}”. Type it like John 3:16 or Psalm 23.':
        'ខ្ញុំមិនអាចអាន “{words}” បានទេ។ សូមវាយដូចជា យ៉ូហាន ៣:១៦ ឬ ទំនុកដំកើង ២៣។',
    'Saved {name} to your Bibles list.':
        'បានរក្សាទុក {name} ក្នុងបញ្ជីព្រះគម្ពីររបស់អ្នករួចហើយ។',
    'I could not save {name} just now.':
        'ខ្ញុំមិនអាចរក្សាទុក {name} បានទេនៅពេលនេះ។',
    'Copied {name}.': 'បានចម្លង {name} រួចហើយ។',
    'I could not copy it just now.': 'ខ្ញុំមិនអាចចម្លងវាបានទេនៅពេលនេះ។',
    'I could not do that just now.': 'ខ្ញុំមិនអាចធ្វើវាបានទេនៅពេលនេះ។',
    'Reading {name} from the app': 'កំពុងអាន {name} ពីកម្មវិធី',
    'I could not read {name} from the app just now. Ask me about it anyway and I will try again.':
        'ខ្ញុំមិនអាចអាន {name} ពីកម្មវិធីបានទេនៅពេលនេះ។ សូមសួរខ្ញុំអំពីវាដដែល ហើយខ្ញុំនឹងព្យាយាមម្ដងទៀត។',
    'I have read {name}. Ask me anything about this passage, or press a question.':
        'ខ្ញុំបានអាន {name} រួចហើយ។ សួរខ្ញុំអ្វីក៏បានអំពីបទគម្ពីរនេះ ឬចុចលើសំណួរមួយ។',
    'I have read {name} in the Bible {bible}. Ask me anything about this passage, or press a question.':
        'ខ្ញុំបានអាន {name} ក្នុងព្រះគម្ពីរ {bible} រួចហើយ។ សួរខ្ញុំអ្វីក៏បានអំពីបទគម្ពីរនេះ ឬចុចលើសំណួរមួយ។',
    'I have read what the names lookup holds on {name} (drawn from the King James Version). Ask me anything about this person, or press a question.':
        'ខ្ញុំបានអានអ្វីដែល ទីកន្លែង-ឈ្មោះ មានអំពី {name} (ដកស្រង់ពីព្រះគម្ពីរ KJV) រួចហើយ។ សួរខ្ញុំអ្វីក៏បានអំពីបុគ្គលនេះ ឬចុចលើសំណួរមួយ។',
    'I have read what the names lookup holds on {name} (drawn from the King James Version). Ask me anything about this place, or press a question.':
        'ខ្ញុំបានអានអ្វីដែល ទីកន្លែង-ឈ្មោះ មានអំពី {name} (ដកស្រង់ពីព្រះគម្ពីរ KJV) រួចហើយ។ សួរខ្ញុំអ្វីក៏បានអំពីទីកន្លែងនេះ ឬចុចលើសំណួរមួយ។',
    'Explain this passage in simple words': 'ពន្យល់បទគម្ពីរនេះដោយពាក្យងាយៗ',
    'What is happening around this passage?':
        'តើមានរឿងអ្វីកើតឡើងនៅជុំវិញបទគម្ពីរនេះ?',
    'How can I apply this passage today?':
        'តើខ្ញុំអាចអនុវត្តបទគម្ពីរនេះក្នុងជីវិតសព្វថ្ងៃដោយរបៀបណា?',
    'Who was {name}?': 'តើ {name} ជានរណា?',
    'What does the Bible say about {name}?':
        'តើព្រះគម្ពីរនិយាយអ្វីខ្លះអំពី {name}?',
    'Tell me about the family of {name}': 'ប្រាប់ខ្ញុំអំពីគ្រួសាររបស់ {name}',
    'Where is {name}?': 'តើ {name} នៅឯណា?',
    'What happened at {name} in the Bible?':
        'តើមានរឿងអ្វីកើតឡើងនៅ {name} ក្នុងព្រះគម្ពីរ?',
    'Which verses mention {name}?': 'តើខគម្ពីរណាខ្លះនិយាយអំពី {name}?',
    'No assistant could answer just now, so here is what the app holds on {name}.':
        'ឥឡូវនេះគ្មានជំនួយការណាអាចឆ្លើយបានទេ ដូច្នេះនេះជាអ្វីដែលកម្មវិធីមានអំពី {name}។',
    'A question about this needs an assistant, and none could answer just now. Pick one in the row above, or add a key in Settings → AI Providers, and ask again.':
        'សំណួរអំពីរឿងនេះត្រូវការជំនួយការ ហើយឥឡូវនេះគ្មានជំនួយការណាអាចឆ្លើយបានទេ។ សូមជ្រើសមួយនៅជួរខាងលើ ឬបន្ថែម API key នៅក្នុង ការកំណត់ → អ្នកផ្តល់សេវា AI រួចសួរម្ដងទៀត។',
    'What the app holds on this goes with every question in this tab. Press × when you are done with it.':
        'អ្វីដែលកម្មវិធីមានអំពីរឿងនេះ ត្រូវបានផ្ញើទៅជាមួយគ្រប់សំណួរក្នុងផ្ទាំងនេះ។ ចុច × នៅពេលអ្នកលែងត្រូវការវា។',
    'Reading what the names lookup has on “{words}”':
        'កំពុងអានអ្វីដែល ទីកន្លែង-ឈ្មោះ មានអំពី “{words}”',
    'Reading the names lookup': 'កំពុងអាន ទីកន្លែង-ឈ្មោះ',
    'Reading “{words}” from Resources': 'កំពុងអាន “{words}” ពីឯកសារពាក់ព័ន្ធ',
    'Looking through Resources': 'កំពុងរកមើលក្នុងឯកសារពាក់ព័ន្ធ',
    'I could not take a picture of the app.': 'ខ្ញុំមិនអាចថតរូបកម្មវិធីបានទេ។',
    'I could not take a picture: {reason}': 'ខ្ញុំមិនអាចថតរូបបានទេ៖ {reason}',
    'Point at the control you mean in the app window…':
        'សូមចង្អុលទៅប៊ូតុងដែលអ្នកចង់និយាយ នៅក្នុងវីនដូកម្មវិធី…',
    'Point at the control you mean in the {window} window…':
        'សូមចង្អុលទៅប៊ូតុងដែលអ្នកចង់និយាយ នៅក្នុងវីនដូ {window}…',
    'Nothing was picked in the app window.':
        'មិនបានជ្រើសអ្វីទេនៅក្នុងវីនដូកម្មវិធី។',
    'I could not point at that one any more.': 'ខ្ញុំមិនអាចចង្អុលទៅវាបានទៀតទេ។',
    'I could not find "{name}" on screen.':
        'ខ្ញុំរកមិនឃើញ "{name}" នៅលើអេក្រង់ទេ។',
    'I could not find "{name}" on screen any more.':
        'ខ្ញុំរកមិនឃើញ "{name}" នៅលើអេក្រង់ទៀតទេ។',
    'That picture is not attached any more — send a new one.':
        'រូបភាពនោះលែងបានភ្ជាប់ទៀតហើយ — សូមផ្ញើរូបថ្មី។',
    'Copied.': 'បានចម្លងហើយ។',
    'I could not copy it: {reason}': 'ខ្ញុំមិនអាចចម្លងវាបានទេ៖ {reason}',
    'I could not download it: {reason}': 'ខ្ញុំមិនអាចទាញយកវាបានទេ៖ {reason}',
    'The assistant is not running in this copy of the app. Restart the app, then open this window again.':
        'ជំនួយការមិនកំពុងដំណើរការក្នុងកម្មវិធីនេះទេ។ សូមបើកកម្មវិធីឡើងវិញ រួចបើកវីនដូនេះម្ដងទៀត។',
    'Stopped. I did not finish writing the report, and nothing was sent — press Report when you want it written.':
        'បានបញ្ឈប់។ ខ្ញុំមិនបានសរសេររបាយការណ៍ចប់ទេ ហើយគ្មានអ្វីត្រូវបានផ្ញើទេ — ចុច រាយការណ៍ នៅពេលអ្នកចង់ឱ្យខ្ញុំសរសេរវា។',
    'Stopped. I did not finish looking that up — press the question above to ask it again.':
        'បានបញ្ឈប់។ ខ្ញុំមិនបានស្វែងរកវាចប់ទេ — ចុចលើសំណួរខាងលើ ដើម្បីសួរវាម្ដងទៀត។',
    'This chat is locked, so it keeps its messages. Unlock it from ⋮ on its tab first, then type `/clear` again.':
        'ការសន្ទនានេះត្រូវបានចាក់សោ ដូច្នេះវារក្សាសាររបស់វាទុក។ សូមដោះសោវាពី ⋮ នៅលើផ្ទាំងរបស់វាជាមុនសិន រួចវាយ `/clear` ម្ដងទៀត។',
    'Searching {bible} for your words':
        'កំពុងស្វែងរកពាក្យរបស់អ្នកក្នុង {bible}',
    'Reading the newest copy of that guide page':
        'កំពុងអានច្បាប់ថ្មីបំផុតនៃទំព័រណែនាំនោះ',
    'A general question needs an assistant, and none could answer just now. Pick one in the row above, or add a key in Settings → AI Providers, and ask again.':
        'សំណួរទូទៅត្រូវការជំនួយការ ហើយឥឡូវនេះគ្មានជំនួយការណាអាចឆ្លើយបានទេ។ សូមជ្រើសមួយនៅជួរខាងលើ ឬបន្ថែម API key នៅក្នុង ការកំណត់ → អ្នកផ្តល់សេវា AI រួចសួរម្ដងទៀត។',
    'I cannot look at pictures while I am offline. Tell me in a few words what you can see and what you were trying to do, and I will look it up in the guide.':
        'ខ្ញុំមិនអាចមើលរូបភាពបានទេ ពេលគ្មានអ៊ីនធឺណិត។ សូមប្រាប់ខ្ញុំដោយពាក្យពីរបីថា អ្នកឃើញអ្វី និងអ្នកកំពុងព្យាយាមធ្វើអ្វី ហើយខ្ញុំនឹងស្វែងរកវានៅក្នុងសៀវភៅណែនាំ។',
    'Auto is checking which assistants can answer':
        'ស្វ័យប្រវត្តិកំពុងពិនិត្យមើលថាជំនួយការណាអាចឆ្លើយបាន',
    'Auto picked {name}': 'ស្វ័យប្រវត្តិបានជ្រើស {name}',
    '{failed} could not answer — {reason}. {provider} answered instead and this chat now uses it; pick {failed} in the row above to switch back.':
        '{failed} មិនអាចឆ្លើយបានទេ — {reason}។ {provider} បានឆ្លើយជំនួស ហើយការសន្ទនានេះឥឡូវប្រើវា។ ជ្រើស {failed} នៅជួរខាងលើ ដើម្បីប្ដូរត្រឡប់វិញ។',
    'Something went wrong inside the app while answering that. Ask it again, or press Report to tell the people who make the app.':
        'មានបញ្ហាកើតឡើងនៅក្នុងកម្មវិធី ពេលកំពុងឆ្លើយសំណួរនោះ។ សូមសួរម្ដងទៀត ឬចុច រាយការណ៍ ដើម្បីប្រាប់អ្នកដែលបង្កើតកម្មវិធីនេះ។',
    'I could not understand that choice. Choose an option below, or say it another way.':
        'ខ្ញុំមិនទាន់យល់ជម្រើសនោះទេ។ សូមជ្រើសរើសជម្រើសខាងក្រោម ឬនិយាយម្តងទៀតដោយពាក្យផ្សេង។',
    'I could not answer that: {reason}':
        'ខ្ញុំមិនអាចឆ្លើយសំណួរនោះបានទេ៖ {reason}',
    'You added that after I had finished looking, so there was no round left to fold it into — I asked it on its own.':
        'អ្នកបានបន្ថែមវាក្រោយពេលខ្ញុំស្វែងរករួចហើយ ដូច្នេះគ្មានជុំណាសល់ដើម្បីបញ្ចូលវាទេ — ខ្ញុំបានសួរវាដាច់ដោយឡែក។',
    'Added while it was working.': 'បានបន្ថែមពេលវាកំពុងធ្វើការ។',
    'Asked by the walkthrough card, not by you.':
        'សួរដោយកាតណែនាំជាជំហាន មិនមែនដោយអ្នកទេ។',
    'No assistant is set up here, so this is what the window could see for itself.':
        'មិនទាន់មានជំនួយការរៀបចំនៅទីនេះទេ ដូច្នេះនេះជាអ្វីដែលវីនដូអាចមើលឃើញដោយខ្លួនឯង។',
    'I could not look into it — {reason}. The report still carries what the window could see for itself.':
        'ខ្ញុំមិនអាចពិនិត្យវាបានទេ — {reason}។ របាយការណ៍នៅតែមានអ្វីដែលវីនដូអាចមើលឃើញដោយខ្លួនឯង។',
    'I could not put a report together: {reason}':
        'ខ្ញុំមិនអាចរៀបចំរបាយការណ៍បានទេ៖ {reason}',
    'Tell me what went wrong first — one line in your own words in the box, then press Report. I will look at the app myself and write the rest of it.':
        'សូមប្រាប់ខ្ញុំជាមុនសិនថាមានបញ្ហាអ្វី — សរសេរមួយបន្ទាត់ដោយពាក្យរបស់អ្នកក្នុងប្រអប់ រួចចុច រាយការណ៍។ ខ្ញុំនឹងពិនិត្យកម្មវិធីដោយខ្លួនឯង ហើយសរសេរផ្នែកដែលនៅសល់។',
    'That report is not prepared any more — this window has been reopened since. Say what is still wrong and press Report, and I will write it up again.':
        'របាយការណ៍នោះលែងបានរៀបចំទុកទៀតហើយ — វីនដូនេះត្រូវបានបើកឡើងវិញតាំងពីពេលនោះ។ សូមប្រាប់ពីអ្វីដែលនៅតែខុស ហើយចុច រាយការណ៍ នោះខ្ញុំនឹងសរសេរវាម្ដងទៀត។',
    'That report is not prepared any more — this window has been reopened since. Press Report again and I will put a new one together.':
        'របាយការណ៍នោះលែងបានរៀបចំទុកទៀតហើយ — វីនដូនេះត្រូវបានបើកឡើងវិញតាំងពីពេលនោះ។ សូមចុច រាយការណ៍ ម្ដងទៀត នោះខ្ញុំនឹងរៀបចំរបាយការណ៍ថ្មី។',
    'Sending the report': 'កំពុងផ្ញើរបាយការណ៍',
    'Stopped. The report was not sent — press Send report when you want it to go.':
        'បានបញ្ឈប់។ របាយការណ៍មិនត្រូវបានផ្ញើទេ — ចុច ផ្ញើរបាយការណ៍ នៅពេលអ្នកចង់ផ្ញើវា។',
    'A copy is in your Downloads folder.':
        'មានច្បាប់ចម្លងមួយនៅក្នុងថត Downloads របស់អ្នក។',
    'It had already gone when you pressed Stop.':
        'វាបានផ្ញើចេញរួចហើយ នៅពេលអ្នកចុច បញ្ឈប់។',
    'This build carries no contact address — pass the saved report on to whoever maintains the app for you.':
        'កំណែនេះមិនមានអាសយដ្ឋានទំនាក់ទំនងទេ — សូមបញ្ជូនរបាយការណ៍ដែលបានរក្សាទុក ទៅអ្នកដែលថែទាំកម្មវិធីឱ្យអ្នក។',
    'Copied `{email}`{source}. Paste it into the To line of your email.':
        'បានចម្លង `{email}`{source}។ សូមបិទភ្ជាប់វានៅក្នុងបន្ទាត់ To (អ្នកទទួល) នៃអ៊ីមែលរបស់អ្នក។',
    'I could not reach the clipboard. The address is `{email}` — you can select and copy it from here.':
        'ខ្ញុំមិនអាចប្រើក្ដារតម្បៀតខ្ទាស់បានទេ។ អាសយដ្ឋានគឺ `{email}` — អ្នកអាចជ្រើស និងចម្លងវាពីទីនេះ។',
    'I no longer have that picture — it is not in this window and not in your Downloads folder. Press Report again and I will take a new one.':
        'ខ្ញុំលែងមានរូបភាពនោះទៀតហើយ — វាមិននៅក្នុងវីនដូនេះ ហើយក៏មិននៅក្នុងថត Downloads របស់អ្នកដែរ។ សូមចុច រាយការណ៍ ម្ដងទៀត នោះខ្ញុំនឹងថតរូបថ្មី។',
    'I could not put the picture on the clipboard. Press its chip above to open the folder and attach the file from there.':
        'ខ្ញុំមិនអាចដាក់រូបភាពទៅក្ដារតម្បៀតខ្ទាស់បានទេ។ សូមចុចលើស្លាករបស់វាខាងលើ ដើម្បីបើកថត ហើយភ្ជាប់ឯកសារពីទីនោះ។',
    'Copied the picture. Paste it into the email — most mail apps take a pasted picture as an attachment.':
        'បានចម្លងរូបភាព។ សូមបិទភ្ជាប់វាទៅក្នុងអ៊ីមែល — កម្មវិធីអ៊ីមែលភាគច្រើនទទួលរូបភាពដែលបិទភ្ជាប់ ជាឯកសារភ្ជាប់។',
    'Copied the picture. Paste it into the email to `{email}` — most mail apps take a pasted picture as an attachment.':
        'បានចម្លងរូបភាព។ សូមបិទភ្ជាប់វាទៅក្នុងអ៊ីមែលផ្ញើទៅ `{email}` — កម្មវិធីអ៊ីមែលភាគច្រើនទទួលរូបភាពដែលបិទភ្ជាប់ ជាឯកសារភ្ជាប់។',
    'I no longer have that report — it is not in this window and not in your Downloads folder. Press Report again and I will put a new one together.':
        'ខ្ញុំលែងមានរបាយការណ៍នោះទៀតហើយ — វាមិននៅក្នុងវីនដូនេះ ហើយក៏មិននៅក្នុងថត Downloads របស់អ្នកដែរ។ សូមចុច រាយការណ៍ ម្ដងទៀត នោះខ្ញុំនឹងរៀបចំរបាយការណ៍ថ្មី។',
    'Copied the subject line `{subject}`. Paste it into the Subject line of your email.':
        'បានចម្លងប្រធានបទ `{subject}`។ សូមបិទភ្ជាប់វានៅក្នុងបន្ទាត់ Subject (ប្រធានបទ) នៃអ៊ីមែលរបស់អ្នក។',
    'I could not reach the clipboard. The subject line is `{subject}` — you can select and copy it from here.':
        'ខ្ញុំមិនអាចប្រើក្ដារតម្បៀតខ្ទាស់បានទេ។ ប្រធានបទគឺ `{subject}` — អ្នកអាចជ្រើស និងចម្លងវាពីទីនេះ។',
    'Copied the whole report. Paste it into your message, and attach `{file}` from your Downloads folder.':
        'បានចម្លងរបាយការណ៍ទាំងមូល។ សូមបិទភ្ជាប់វាទៅក្នុងសាររបស់អ្នក ហើយភ្ជាប់ `{file}` ពីថត Downloads របស់អ្នក។',
    'Copied the whole report. Paste it into your message.':
        'បានចម្លងរបាយការណ៍ទាំងមូល។ សូមបិទភ្ជាប់វាទៅក្នុងសាររបស់អ្នក។',
    'Copied the whole report. Paste it into an email to `{email}`, and attach `{file}` from your Downloads folder.':
        'បានចម្លងរបាយការណ៍ទាំងមូល។ សូមបិទភ្ជាប់វាទៅក្នុងអ៊ីមែលផ្ញើទៅ `{email}` ហើយភ្ជាប់ `{file}` ពីថត Downloads របស់អ្នក។',
    'Copied the whole report. Paste it into an email to `{email}`.':
        'បានចម្លងរបាយការណ៍ទាំងមូល។ សូមបិទភ្ជាប់វាទៅក្នុងអ៊ីមែលផ្ញើទៅ `{email}`។',
    'I could not reach the clipboard. Open the report file from the chip above — it is a plain text document you can select and copy from.':
        'ខ្ញុំមិនអាចប្រើក្ដារតម្បៀតខ្ទាស់បានទេ។ សូមបើកឯកសាររបាយការណ៍ពីស្លាកខាងលើ — វាជាឯកសារអត្ថបទធម្មតា ដែលអ្នកអាចជ្រើស និងចម្លងបាន។',
    'The report is on your clipboard — paste it into the message, and attach `{file}` from your Downloads folder.':
        'របាយការណ៍នៅលើក្ដារតម្បៀតខ្ទាស់របស់អ្នក — សូមបិទភ្ជាប់វាទៅក្នុងសារ ហើយភ្ជាប់ `{file}` ពីថត Downloads របស់អ្នក។',
    'The report is on your clipboard — paste it into the message.':
        'របាយការណ៍នៅលើក្ដារតម្បៀតខ្ទាស់របស់អ្នក — សូមបិទភ្ជាប់វាទៅក្នុងសារ។',
    'I could not reach the clipboard, so press **Copy report** and paste it into the message, and attach `{file}` from your Downloads folder.':
        'ខ្ញុំមិនអាចប្រើក្ដារតម្បៀតខ្ទាស់បានទេ ដូច្នេះសូមចុច **ចម្លងរបាយការណ៍** រួចបិទភ្ជាប់វាទៅក្នុងសារ ហើយភ្ជាប់ `{file}` ពីថត Downloads របស់អ្នក។',
    'I could not reach the clipboard, so press **Copy report** and paste it into the message.':
        'ខ្ញុំមិនអាចប្រើក្ដារតម្បៀតខ្ទាស់បានទេ ដូច្នេះសូមចុច **ចម្លងរបាយការណ៍** រួចបិទភ្ជាប់វាទៅក្នុងសារ។',
    'Opening your email app with `{email}` and the subject filled in.':
        'កំពុងបើកកម្មវិធីអ៊ីមែលរបស់អ្នក ដោយបំពេញ `{email}` និងប្រធានបទរួចហើយ។',
    'If nothing opened, this machine has no email app set up — use the two Copy buttons instead.':
        'បើគ្មានអ្វីបើកទេ មានន័យថាកុំព្យូទ័រនេះមិនទាន់មានកម្មវិធីអ៊ីមែលទេ — សូមប្រើប៊ូតុងចម្លងទាំងពីរជំនួសវិញ។',
    'I could not reach the clipboard. The song is in my answer above — you can select and copy it from there.':
        'ខ្ញុំមិនអាចប្រើក្ដារតម្បៀតខ្ទាស់បានទេ។ ចម្រៀងនៅក្នុងចម្លើយរបស់ខ្ញុំខាងលើ — អ្នកអាចជ្រើស និងចម្លងវាពីទីនោះ។',
    'Copied. Paste it into the Lyric Editor and it will open as a song.':
        'បានចម្លងហើយ។ សូមបិទភ្ជាប់វាទៅក្នុងកម្មវិធីកែសម្រួលទំនុកច្រៀង នោះវានឹងបើកជាចម្រៀងមួយ។',
    'That song could not be saved. Check there is room in your documents folder, then press the button again.':
        'មិនអាចរក្សាទុកចម្រៀងនោះបានទេ។ សូមពិនិត្យថាថតឯកសាររបស់អ្នកនៅមានទំហំទំនេរ រួចចុចប៊ូតុងម្ដងទៀត។',
    'Saved as "{name}". It is in your documents list now, ready to put on the screen — open it in the Lyric Editor to change the words or mark the chords.':
        'បានរក្សាទុកជា "{name}"។ ឥឡូវវានៅក្នុងបញ្ជីឯកសាររបស់អ្នក ត្រៀមដាក់បង្ហាញលើអេក្រង់ — បើកវាក្នុងកម្មវិធីកែសម្រួលទំនុកច្រៀង ដើម្បីកែពាក្យ ឬដាក់អាកូដ។',
    'Opening a search for it in your browser. When you find the reference, type it here and I will read it from your Bible.':
        'កំពុងបើកការស្វែងរកវាក្នុងកម្មវិធីរុករករបស់អ្នក។ ពេលអ្នករកឃើញខគម្ពីរ សូមវាយវានៅទីនេះ នោះខ្ញុំនឹងអានវាពីព្រះគម្ពីររបស់អ្នក។',
    'This chat is not asking that assistant any more. Pick the model you want in the MODEL list at the top of this window, then ask again.':
        'ការសន្ទនានេះលែងសួរជំនួយការនោះទៀតហើយ។ សូមជ្រើសម៉ូដែលដែលអ្នកចង់បាន ក្នុងបញ្ជី ម៉ូដែល នៅខាងលើវីនដូនេះ រួចសួរម្ដងទៀត។',
    'Asked again with {model}, and this chat now uses it — pick another in the MODEL list at the top of this window to switch back.':
        'បានសួរម្ដងទៀតជាមួយ {model} ហើយការសន្ទនានេះឥឡូវប្រើវា — ជ្រើសម៉ូដែលផ្សេងក្នុងបញ្ជី ម៉ូដែល នៅខាងលើវីនដូនេះ ដើម្បីប្ដូរត្រឡប់វិញ។',
    'Asking your question again.': 'កំពុងសួរសំណួររបស់អ្នកម្ដងទៀត។',
    'Opening {address} in your browser.':
        'កំពុងបើក {address} ក្នុងកម្មវិធីរុករករបស់អ្នក។',
    'Show the choices again: which window, which assistant, which model and the limit per hour':
        'បង្ហាញជម្រើសម្ដងទៀត៖ វីនដូណា ជំនួយការណា ម៉ូដែលណា និងដែនកំណត់ក្នុងមួយម៉ោង',
    'Fold these choices to one line': 'បង្រួមជម្រើសទាំងនេះឱ្យនៅមួយបន្ទាត់',
    'Reload shared assistants': 'ផ្ទុកជំនួយការដែលបានចែករំលែកឡើងវិញ',
    'Answers from': 'ចម្លើយពី',
    '{names} need an API key of your own — open AI settings':
        '{names} ត្រូវការ API key ផ្ទាល់ខ្លួនរបស់អ្នក — បើកការកំណត់ AI',
    'Auto pick': 'ការជ្រើសស្វ័យប្រវត្តិ',
    Model: 'ម៉ូដែល',
    'Try asking': 'សាកល្បងសួរ',
    'Press to put this in the box, then change the example to yours':
        'ចុចដើម្បីដាក់វាក្នុងប្រអប់ រួចប្ដូរឧទាហរណ៍ទៅជារបស់អ្នក',
    'Guided demo: {demo}': 'ការបង្ហាញណែនាំ៖ {demo}',
    'Back to the four suggestions': 'ត្រឡប់ទៅការណែនាំទាំងបួនវិញ',
    'Show everything it is ready to be asked here':
        'បង្ហាញសំណួរទាំងអស់ដែលវាអាចឆ្លើយនៅទីនេះ',
    Fewer: 'តិចជាងនេះ',
    'More… — everything it can answer':
        'ច្រើនទៀត… — អ្វីៗទាំងអស់ដែលវាអាចឆ្លើយបាន',
    "Answers come from the app's own guide and from what the app is doing right now.":
        'ចម្លើយមកពីសៀវភៅណែនាំរបស់កម្មវិធី និងពីអ្វីដែលកម្មវិធីកំពុងធ្វើនៅពេលនេះ។',
    'Be careful with AI answers.': 'សូមប្រុងប្រយ័ត្នជាមួយចម្លើយរបស់ AI។',
    'This assistant can be confidently wrong — it can misread the app, describe a button that is not there, or quote a verse inaccurately — and what it offers to do can reach a live projector. Check anything that matters before a service, and read a step yourself before you press it. It is here to help you use the app, not to replace knowing it.':
        'ជំនួយការនេះអាចខុស ទោះបីវានិយាយដោយទំនុកចិត្តក៏ដោយ — វាអាចអានកម្មវិធីខុស ពណ៌នាប៊ូតុងដែលគ្មានពិត ឬដកស្រង់ខគម្ពីរមិនត្រឹមត្រូវ — ហើយអ្វីដែលវាស្នើធ្វើ អាចប៉ះពាល់ដល់ការបញ្ចាំងផ្ទាល់។ សូមពិនិត្យរាល់អ្វីដែលសំខាន់មុនពេលថ្វាយបង្គំ ហើយអានជំហាននីមួយៗដោយខ្លួនឯងមុនពេលចុច។ វានៅទីនេះដើម្បីជួយអ្នកប្រើកម្មវិធី មិនមែនដើម្បីជំនួសការស្គាល់កម្មវិធីនោះទេ។',
    'Put this caution away for 30 days; it comes back after that':
        'លាក់ការព្រមាននេះរយៈពេល ៣០ ថ្ងៃ បន្ទាប់មកវានឹងត្រឡប់មកវិញ',
    '{names} answer here only with an API key of your own.':
        '{names} ឆ្លើយនៅទីនេះបាន លុះត្រាតែមាន API key ផ្ទាល់ខ្លួនរបស់អ្នក។',
    'Go to the newest message': 'ទៅកាន់សារថ្មីបំផុត',
    'Use {model}': 'ប្រើ {model}',
    'Report “{quote}”? I will look into it in the app and write it up. The report carries {collects} — nothing is sent until you say so.':
        'រាយការណ៍ “{quote}” ឬ? ខ្ញុំនឹងពិនិត្យវាក្នុងកម្មវិធី ហើយសរសេរជារបាយការណ៍។ របាយការណ៍នេះមាន {collects} — គ្មានអ្វីត្រូវបានផ្ញើទេ រហូតដល់អ្នកយល់ព្រម។',
    'Report it': 'រាយការណ៍វា',
    'Attach a file': 'ភ្ជាប់ឯកសារ',
    'Attach a picture or a file': 'ភ្ជាប់រូបភាព ឬឯកសារ',
    'Attach a picture of the app': 'ភ្ជាប់រូបភាពកម្មវិធី',
    'Attach a picture of the app as it looks now':
        'ភ្ជាប់រូបភាពកម្មវិធី ដូចដែលវាមើលទៅពេលនេះ',
    'Point at a control in the app': 'ចង្អុលទៅប៊ូតុងមួយក្នុងកម្មវិធី',
    'Point at a control in the app window':
        'ចង្អុលទៅប៊ូតុងមួយក្នុងវីនដូកម្មវិធី',
    'Add anything else while it works…':
        'បន្ថែមអ្វីផ្សេងទៀត ខណៈពេលវាកំពុងធ្វើការ…',
    'Ask how to do something, or type / for a command…':
        'សួររបៀបធ្វើអ្វីមួយ ឬវាយ / សម្រាប់ពាក្យបញ្ជា…',
    'Ask how to do something in the app': 'សួររបៀបធ្វើអ្វីមួយក្នុងកម្មវិធី',
    'Ctrl+Enter sends · Enter starts a new line · Alt+↑ and Alt+↓ bring back an earlier question · / lists the commands that need no assistant · ↑ and ↓ walk a list of suggestions, Tab takes one':
        'Ctrl+Enter ដើម្បីផ្ញើ · Enter ដើម្បីចុះបន្ទាត់ថ្មី · Alt+↑ និង Alt+↓ នាំសំណួរមុនៗមកវិញ · / បង្ហាញពាក្យបញ្ជាដែលមិនត្រូវការជំនួយការ · ↑ និង ↓ ដើរក្នុងបញ្ជីការណែនាំ ហើយ Tab យកមួយ',
    'Add this to the answer being written — Ctrl+Enter':
        'បន្ថែមវាទៅចម្លើយដែលកំពុងសរសេរ — Ctrl+Enter',
    'Add more': 'បន្ថែម',
    'Stop looking it up': 'បញ្ឈប់ការស្វែងរក',
    'Send — Ctrl+Enter': 'ផ្ញើ — Ctrl+Enter',
    Send: 'ផ្ញើ',
    'Ask — Ctrl+Enter': 'សួរ — Ctrl+Enter',
    Ask: 'សួរ',
    'Report a problem with the app': 'រាយការណ៍បញ្ហាជាមួយកម្មវិធី',
    'Report a problem: I will look into it, collect what is on this machine and write it up for you':
        'រាយការណ៍បញ្ហា៖ ខ្ញុំនឹងពិនិត្យវា ប្រមូលព័ត៌មាននៅលើកុំព្យូទ័រនេះ ហើយសរសេររបាយការណ៍ជូនអ្នក',
    'Preview of {name}': 'មើលជាមុន {name}',
    'Download {name} into your Downloads folder':
        'ទាញយក {name} ទៅក្នុងថត Downloads របស់អ្នក',
    'Press anywhere to close': 'ចុចកន្លែងណាក៏បាន ដើម្បីបិទ',
    'Reload the assistants shared on openworship.app':
        'ផ្ទុកជំនួយការដែលបានចែករំលែកនៅលើ openworship.app ឡើងវិញ',
    'Auto picks the best assistant that costs nothing, again for every question — one of your own servers that is on and not busy, the bigger model first, or the free service':
        'ស្វ័យប្រវត្តិជ្រើសជំនួយការល្អបំផុតដែលមិនគិតថ្លៃ ម្ដងទៀតសម្រាប់គ្រប់សំណួរ — ម៉ាស៊ីនមេផ្ទាល់ខ្លួនរបស់អ្នកដែលកំពុងបើក និងមិនរវល់ (ម៉ូដែលធំជាងមុនគេ) ឬសេវាឥតគិតថ្លៃ',
    'chosen at each question': 'ជ្រើសនៅរាល់សំណួរ',
    'app guide · offline': 'សៀវភៅណែនាំកម្មវិធី · ក្រៅបណ្ដាញ',
    'This assistant cannot look at pictures. Pick one that can, or take the picture off and describe it instead.':
        'ជំនួយការនេះមិនអាចមើលរូបភាពបានទេ។ សូមជ្រើសជំនួយការដែលអាចមើលបាន ឬដករូបភាពចេញ ហើយពណ៌នាវាជាពាក្យជំនួសវិញ។',
    'This model is not marked as able to look at pictures. If it can, tick Sees pictures for it in Settings → AI Providers → Custom servers; or take the picture off and describe it instead.':
        'ម៉ូដែលនេះមិនត្រូវបានកំណត់ថាអាចមើលរូបភាពបានទេ។ បើវាអាចមើលបាន សូមធីក មើលរូបភាពបាន សម្រាប់វា នៅក្នុង ការកំណត់ → អ្នកផ្តល់សេវា AI → ម៉ាស៊ីនមេផ្ទាល់ខ្លួន ឬដករូបភាពចេញ ហើយពណ៌នាវាជាពាក្យជំនួសវិញ។',
    '{name} (the one in Find)': '{name} (ដែលនៅក្នុងការស្វែងរក)',
    'Open {verse} in Bible Lookup': 'បើក {verse} ក្នុងការស្វែងរកព្រះគម្ពីរ',
    'Send a picture of my screen': 'ផ្ញើរូបភាពអេក្រង់របស់ខ្ញុំ',
    'Point at the control': 'ចង្អុលទៅប៊ូតុង',
    'Reporting a problem.': 'កំពុងរាយការណ៍បញ្ហា។',
    'Solved without a report.': 'បានដោះស្រាយដោយមិនចាំបាច់រាយការណ៍។',
    'I searched the Bible for your words myself instead.':
        'ខ្ញុំបានស្វែងរកពាក្យរបស់អ្នកក្នុងព្រះគម្ពីរដោយខ្លួនឯងជំនួសវិញ។',
    'main window': 'វីនដូមេ',
    'own window': 'វីនដូដាច់ដោយឡែក',
    'Claude Haiku 5.5 (best recommended)': 'Claude Haiku 5.5 (ណែនាំបំផុត)',
    'Highlight again': 'គូសបញ្ជាក់ម្ដងទៀត',
    'Search another Bible': 'ស្វែងរកក្នុងព្រះគម្ពីរផ្សេងទៀត',
    'Search Google for it': 'ស្វែងរកវាលើ Google',
    'Clear {count} chat?': 'លុបការសន្ទនា {count} មែនទេ?',
    'Close {count} chat?': 'បិទការសន្ទនា {count} មែនទេ?',
    'Clear {count} chats?': 'លុបការសន្ទនា {count} មែនទេ?',
    'Close {count} chats?': 'បិទការសន្ទនា {count} មែនទេ?',
    'The locked one stays.': 'ការសន្ទនាដែលចាក់សោនៅដដែល។',
    'The locked ones stay.': 'ការសន្ទនាដែលចាក់សោនៅដដែល។',
    'This cannot be undone.': 'សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។',
    Chats: 'ការសន្ទនា',
    'More for {title}': 'ជម្រើសបន្ថែមសម្រាប់ {title}',
    More: 'ច្រើនទៀត',
    'Name this chat': 'ដាក់ឈ្មោះការសន្ទនានេះ',
    '{title} — double-click to rename': '{title} — ចុចពីរដងដើម្បីកែឈ្មោះ',
    '{title} is working on an answer': '{title} កំពុងរៀបចំចម្លើយ',
    '{title} is locked': '{title} ត្រូវបានចាក់សោ',
    'Locked — unlock it from this tab’s menu to close it':
        'បានចាក់សោ — សូមដោះសោពីម៉ឺនុយរបស់ការសន្ទនានេះ ដើម្បីបិទវា',
    'Close {title}': 'បិទ {title}',
    'Close this chat': 'បិទការសន្ទនានេះ',
    'New chat': 'ការសន្ទនាថ្មី',
    'Close one of these before starting another':
        'សូមបិទការសន្ទនាមួយសិន មុននឹងចាប់ផ្ដើមការសន្ទនាថ្មី',
    'No room for another chat': 'គ្មានកន្លែងសម្រាប់ការសន្ទនាថ្មីទៀតទេ',
    'This window holds {count} chats at most. Close one to start a new chat.':
        'បង្អួចនេះផ្ទុកការសន្ទនាបានច្រើនបំផុត {count}។ សូមបិទការសន្ទនាមួយ ដើម្បីចាប់ផ្ដើមការសន្ទនាថ្មី។',
    'This window holds {count} chats at most, and all of them are locked. Unlock one from its ⋮ menu and close it to start a new chat.':
        'បង្អួចនេះផ្ទុកការសន្ទនាបានច្រើនបំផុត {count} ហើយការសន្ទនាទាំងអស់ត្រូវបានចាក់សោ។ សូមដោះសោការសន្ទនាមួយពីម៉ឺនុយ ⋮ របស់វា ហើយបិទវា ដើម្បីចាប់ផ្ដើមការសន្ទនាថ្មី។',
    'New window': 'បង្អួចថ្មី',
    'Clear all chats': 'លុបការសន្ទនាទាំងអស់',
    'Close other chats': 'បិទការសន្ទនាផ្សេងទៀត',
    'Keep them': 'ទុកវាដដែល',
    'Close them': 'បិទវា',
    'Rename this chat': 'កែឈ្មោះការសន្ទនានេះ',
    'Unlock this chat': 'ដោះសោការសន្ទនានេះ',
    'Lock this chat': 'ចាក់សោការសន្ទនានេះ',
    'Open in new window': 'បើកក្នុងបង្អួចថ្មី',
    'Close other chats…': 'បិទការសន្ទនាផ្សេងទៀត…',
    'Clear all chats…': 'លុបការសន្ទនាទាំងអស់…',
    'Looking through your songs': 'កំពុងមើលចម្រៀងរបស់អ្នក',
    'Reading one of your song': 'កំពុងអានចម្រៀងមួយរបស់អ្នក',
    'Reading one of your song: “{name}”': 'កំពុងអានចម្រៀងរបស់អ្នក៖ “{name}”',
    'Creating a new song': 'កំពុងបង្កើតចម្រៀងថ្មី',
    'Creating a new song: “{name}”': 'កំពុងបង្កើតចម្រៀងថ្មី៖ “{name}”',
    'Editing a song': 'កំពុងកែសម្រួលចម្រៀង',
    'Editing a song: “{name}”': 'កំពុងកែសម្រួលចម្រៀង៖ “{name}”',
    'Renaming a song': 'កំពុងកែឈ្មោះចម្រៀង',
    'Renaming a song: “{name}”': 'កំពុងកែឈ្មោះចម្រៀង៖ “{name}”',
    'Moving a song to the trash': 'កំពុងផ្លាស់ចម្រៀងទៅធុងសំរាម',
    'Moving your song “{name}” to the trash':
        'កំពុងផ្លាស់ចម្រៀង “{name}” របស់អ្នកទៅធុងសំរាម',
    'Working on your songs': 'កំពុងធ្វើការលើចម្រៀងរបស់អ្នក',
    'Looking through your slide documents': 'កំពុងមើលឯកសារស្លាយរបស់អ្នក',
    'Reading one of your slide document': 'កំពុងអានឯកសារស្លាយមួយរបស់អ្នក',
    'Reading one of your slide document: “{name}”':
        'កំពុងអានឯកសារស្លាយរបស់អ្នក៖ “{name}”',
    'Creating a new slide document': 'កំពុងបង្កើតឯកសារស្លាយថ្មី',
    'Creating a new slide document: “{name}”':
        'កំពុងបង្កើតឯកសារស្លាយថ្មី៖ “{name}”',
    'Editing a slide document': 'កំពុងកែសម្រួលឯកសារស្លាយ',
    'Editing a slide document: “{name}”': 'កំពុងកែសម្រួលឯកសារស្លាយ៖ “{name}”',
    'Renaming a slide document': 'កំពុងកែឈ្មោះឯកសារស្លាយ',
    'Renaming a slide document: “{name}”': 'កំពុងកែឈ្មោះឯកសារស្លាយ៖ “{name}”',
    'Moving a slide document to the trash': 'កំពុងផ្លាស់ឯកសារស្លាយទៅធុងសំរាម',
    'Moving your slide document “{name}” to the trash':
        'កំពុងផ្លាស់ឯកសារស្លាយ “{name}” របស់អ្នកទៅធុងសំរាម',
    'Working on your slide documents': 'កំពុងធ្វើការលើឯកសារស្លាយរបស់អ្នក',
    'Reading the slides': 'កំពុងអានស្លាយ',
    'Reading the slides of “{name}”': 'កំពុងអានស្លាយនៃ “{name}”',
    'Adding a slide': 'កំពុងបន្ថែមស្លាយ',
    'Adding a slide to “{name}”': 'កំពុងបន្ថែមស្លាយទៅ “{name}”',
    'Changing a slide': 'កំពុងកែស្លាយ',
    'Changing slide {slide}': 'កំពុងកែស្លាយទី {slide}',
    'Changing a slide of “{name}”': 'កំពុងកែស្លាយមួយនៃ “{name}”',
    'Changing slide {slide} of “{name}”': 'កំពុងកែស្លាយទី {slide} នៃ “{name}”',
    'Removing a slide': 'កំពុងដកស្លាយចេញ',
    'Removing slide {slide}': 'កំពុងដកស្លាយទី {slide} ចេញ',
    'Removing a slide from “{name}”': 'កំពុងដកស្លាយមួយចេញពី “{name}”',
    'Removing slide {slide} from “{name}”':
        'កំពុងដកស្លាយទី {slide} ចេញពី “{name}”',
    'Moving a slide': 'កំពុងផ្លាស់ទីស្លាយ',
    'Moving slide {slide}': 'កំពុងផ្លាស់ទីស្លាយទី {slide}',
    'Moving a slide of “{name}”': 'កំពុងផ្លាស់ទីស្លាយមួយនៃ “{name}”',
    'Moving slide {slide} of “{name}”':
        'កំពុងផ្លាស់ទីស្លាយទី {slide} នៃ “{name}”',
    'Copying a slide': 'កំពុងចម្លងស្លាយ',
    'Copying slide {slide}': 'កំពុងចម្លងស្លាយទី {slide}',
    'Copying a slide of “{name}”': 'កំពុងចម្លងស្លាយមួយនៃ “{name}”',
    'Copying slide {slide} of “{name}”':
        'កំពុងចម្លងស្លាយទី {slide} នៃ “{name}”',
    'Looking through your saved Bible passages':
        'កំពុងមើលបទគម្ពីរដែលអ្នកបានរក្សាទុក',
    'Changing a saved Bible passage': 'កំពុងកែបទគម្ពីរដែលបានរក្សាទុក',
    'Removing a saved Bible passage': 'កំពុងដកបទគម្ពីរដែលបានរក្សាទុកចេញ',
    'Making a Bibles list': 'កំពុងបង្កើតបញ្ជីព្រះគម្ពីរ',
    'Renaming a Bibles list': 'កំពុងកែឈ្មោះបញ្ជីព្រះគម្ពីរ',
    'Moving a Bibles list to the trash': 'កំពុងផ្លាស់បញ្ជីព្រះគម្ពីរទៅធុងសំរាម',
    'Looking through your Bible notes': 'កំពុងមើលកំណត់ត្រាព្រះគម្ពីររបស់អ្នក',
    'Reading a Bible note': 'កំពុងអានកំណត់ត្រាព្រះគម្ពីរ',
    'Writing a Bible note': 'កំពុងសរសេរកំណត់ត្រាព្រះគម្ពីរ',
    'Changing a Bible note': 'កំពុងកែកំណត់ត្រាព្រះគម្ពីរ',
    'Removing a Bible note': 'កំពុងដកកំណត់ត្រាព្រះគម្ពីរចេញ',
    'Making a notes file': 'កំពុងបង្កើតឯកសារកំណត់ត្រា',
    'Renaming a notes file': 'កំពុងកែឈ្មោះឯកសារកំណត់ត្រា',
    'Moving a notes file to the trash': 'កំពុងផ្លាស់ឯកសារកំណត់ត្រាទៅធុងសំរាម',
    'Looking through the recent changes': 'កំពុងមើលការផ្លាស់ប្ដូរថ្មីៗ',
    'Putting back an earlier change': 'កំពុងត្រឡប់ការផ្លាស់ប្ដូរមុនវិញ',
    'Looking through your run sheets': 'កំពុងមើលតារាងកម្មវិធីរបស់អ្នក',
    'Reading a run sheet': 'កំពុងអានតារាងកម្មវិធី',
    'Making a run sheet': 'កំពុងបង្កើតតារាងកម្មវិធី',
    'Renaming a run sheet': 'កំពុងកែឈ្មោះតារាងកម្មវិធី',
    'Moving a run sheet to the trash': 'កំពុងផ្លាស់តារាងកម្មវិធីទៅធុងសំរាម',
    'Adding a line to a run sheet': 'កំពុងបន្ថែមជួរមួយទៅតារាងកម្មវិធី',
    'Taking a line off a run sheet': 'កំពុងដកជួរមួយចេញពីតារាងកម្មវិធី',
    'Moving a line of a run sheet': 'កំពុងផ្លាស់ទីជួរមួយក្នុងតារាងកម្មវិធី',
    'Copying a line of a run sheet': 'កំពុងចម្លងជួរមួយក្នុងតារាងកម្មវិធី',
    'Parking a line of a run sheet': 'កំពុងផ្អាកជួរមួយក្នុងតារាងកម្មវិធី',
    'Putting a parked line back in the run':
        'កំពុងដាក់ជួរដែលបានផ្អាក ត្រឡប់ចូលកម្មវិធីវិញ',
    'Working on your saved Bible passages':
        'កំពុងធ្វើការលើបទគម្ពីរដែលអ្នកបានរក្សាទុក',
    'Working on your Bible notes': 'កំពុងធ្វើការលើកំណត់ត្រាព្រះគម្ពីររបស់អ្នក',
    'Working on a run sheet': 'កំពុងធ្វើការលើតារាងកម្មវិធី',
    'Saving to your Bibles list: “{words}”':
        'កំពុងរក្សាទុកក្នុងបញ្ជីព្រះគម្ពីររបស់អ្នក៖ “{words}”',
    'Saving a passage to your Bibles list':
        'កំពុងរក្សាទុកបទគម្ពីរក្នុងបញ្ជីព្រះគម្ពីររបស់អ្នក',
    'Looking something up': 'កំពុងស្វែងរកព័ត៌មាន',
    'Downloading the Bible file and reading it':
        'កំពុងទាញយកឯកសារព្រះគម្ពីរ ហើយអានវា',
    'Finding Bible book names for your language':
        'កំពុងរកឈ្មោះគម្ពីរនីមួយៗសម្រាប់ភាសារបស់អ្នក',
    'Installing the Bible': 'កំពុងដំឡើងព្រះគម្ពីរ',
    'Changing the Bible': 'កំពុងកែព្រះគម្ពីរ',
    'Moving the Bible to the trash': 'កំពុងផ្លាស់ព្រះគម្ពីរទៅធុងសំរាម',
    'Looking at your Bibles': 'កំពុងមើលព្រះគម្ពីររបស់អ្នក',
    'Taking the countdown off the screen': 'កំពុងដករាប់ថយក្រោយចេញពីអេក្រង់',
    'Taking the stopwatch off the screen': 'កំពុងដកនាឡិកាបញ្ឈប់ចេញពីអេក្រង់',
    'Taking the clock off the screen': 'កំពុងដកនាឡិកាចេញពីអេក្រង់',
    'Taking the scrolling message off the screen':
        'កំពុងដកអក្សររត់ចេញពីអេក្រង់',
    'Taking the line of text off the screen': 'កំពុងដកអត្ថបទរហ័សចេញពីអេក្រង់',
    'Taking the extras off the screen': 'កំពុងដកអ្វីៗនៅផ្ទៃខាងមុខចេញពីអេក្រង់',
    'Taking an extra off the screen': 'កំពុងដកអ្វីមួយនៅផ្ទៃខាងមុខចេញពីអេក្រង់',
    'Checking the extras on the screen':
        'កំពុងពិនិត្យអ្វីៗនៅផ្ទៃខាងមុខលើអេក្រង់',
    'Starting a {minutes} minute countdown on the screen':
        'កំពុងចាប់ផ្ដើមរាប់ថយក្រោយ {minutes} នាទីនៅលើអេក្រង់',
    'Starting a countdown to “{words}”':
        'កំពុងចាប់ផ្ដើមរាប់ថយក្រោយដល់ “{words}”',
    'Starting a countdown on the screen':
        'កំពុងចាប់ផ្ដើមរាប់ថយក្រោយនៅលើអេក្រង់',
    'Starting a stopwatch on the screen':
        'កំពុងចាប់ផ្ដើមនាឡិកាបញ្ឈប់នៅលើអេក្រង់',
    'Putting a clock on the screen': 'កំពុងដាក់នាឡិកានៅលើអេក្រង់',
    'Putting a scrolling message on the screen': 'កំពុងដាក់អក្សររត់នៅលើអេក្រង់',
    'Putting a line of text on the screen': 'កំពុងដាក់អត្ថបទរហ័សនៅលើអេក្រង់',
    'Putting an extra on the screen': 'កំពុងដាក់អ្វីមួយនៅផ្ទៃខាងមុខលើអេក្រង់',
    'Searching the guide for “{words}”':
        'កំពុងស្វែងរក “{words}” ក្នុងមគ្គុទ្ទេសក៍',
    'Searching the guide': 'កំពុងស្វែងរកក្នុងមគ្គុទ្ទេសក៍',
    'Reading the guide': 'កំពុងអានមគ្គុទ្ទេសក៍',
    'Looking through what it can answer': 'កំពុងមើលសំណួរដែលវាអាចឆ្លើយបាន',
    'Checking what the app is showing':
        'កំពុងពិនិត្យអ្វីដែលកម្មវិធីកំពុងបង្ហាញ',
    'Looking over the buttons on screen': 'កំពុងមើលប៊ូតុងនៅលើអេក្រង់',
    'Looking for “{words}”': 'កំពុងរក “{words}”',
    'Looking for a button': 'កំពុងរកប៊ូតុង',
    'Pressing “{words}”': 'កំពុងចុច “{words}”',
    'Pressing a button': 'កំពុងចុចប៊ូតុង',
    'Typing into “{words}”': 'កំពុងវាយបញ្ចូលក្នុង “{words}”',
    'Typing something': 'កំពុងវាយអក្សរ',
    'Switching the app window over': 'កំពុងប្ដូរទំព័រនៃបង្អួចកម្មវិធី',
    'Checking the projector screens': 'កំពុងពិនិត្យអេក្រង់បញ្ចាំង',
    'Clearing the projector screens': 'កំពុងលុបអេក្រង់បញ្ចាំង',
    'Reading the passage “{words}”': 'កំពុងអានបទគម្ពីរ “{words}”',
    'Reading a Bible passage': 'កំពុងអានបទគម្ពីរ',
    'Putting a Bible passage on the screen: “{words}”':
        'កំពុងដាក់បទគម្ពីរនៅលើអេក្រង់៖ “{words}”',
    'Putting a Bible passage on the screen': 'កំពុងដាក់បទគម្ពីរនៅលើអេក្រង់',
    'Opening in the Bible Lookup: “{words}”':
        'កំពុងបើកក្នុង ស្វែងរកព្រះគម្ពីរ៖ “{words}”',
    'Opening a verse in the Bible Lookup':
        'កំពុងបើកខគម្ពីរក្នុង ស្វែងរកព្រះគម្ពីរ',
    'Reading “{words}”': 'កំពុងអាន “{words}”',
    'Reading Bible verses': 'កំពុងអានខគម្ពីរ',
    'Searching the Bible for “{words}”':
        'កំពុងស្វែងរក “{words}” ក្នុងព្រះគម្ពីរ',
    'Looking at the Bibles installed': 'កំពុងមើលព្រះគម្ពីរដែលបានដំឡើង',
    'Checking what that button is called here':
        'កំពុងពិនិត្យថាប៊ូតុងនោះមានឈ្មោះអ្វីនៅទីនេះ',
    'Reading a web page': 'កំពុងអានទំព័របណ្ដាញ',
    'Reading {site}': 'កំពុងអាន {site}',
    'Reading {site} and writing the song out':
        'កំពុងអាន {site} ហើយសរសេរចម្រៀងចេញ',
    'Looking up the song “{words}”': 'កំពុងរកចម្រៀង “{words}”',
    'Looking up the song': 'កំពុងរកចម្រៀង',
    'Writing the song out': 'កំពុងសរសេរចម្រៀង',
    'Checking the song over': 'កំពុងពិនិត្យចម្រៀង',
    'Setting up a walkthrough': 'កំពុងរៀបចំការណែនាំម្តងមួយជំហាន',
    'Moving the walkthrough on': 'កំពុងបន្តការណែនាំទៅជំហានបន្ទាប់',
    'Checking on the walkthrough': 'កំពុងពិនិត្យការណែនាំម្តងមួយជំហាន',
    'Looking over the window': 'កំពុងមើលបង្អួច',
    'Checking which windows are open': 'កំពុងពិនិត្យថាបង្អួចណាខ្លះកំពុងបើក',
    'Switching to another window': 'កំពុងប្ដូរទៅបង្អួចផ្សេង',
    'Pressing a key': 'កំពុងចុចគ្រាប់ចុច',
    'Waiting for the app to catch up': 'កំពុងរង់ចាំកម្មវិធីរួចរាល់',
    "Reading the app's own log": 'កំពុងអានកំណត់ហេតុរបស់កម្មវិធី',
    'Checking what the app has downloaded':
        'កំពុងពិនិត្យអ្វីដែលកម្មវិធីបានទាញយក',
    'Answering a message the app put up': 'កំពុងឆ្លើយសារដែលកម្មវិធីបានបង្ហាញ',
    'under $0.001': 'តិចជាង $0.001',
    'price not known': 'មិនដឹងតម្លៃ',
    '≈ {dollars} + some at an unknown price': '≈ {dollars} + ខ្លះមិនដឹងតម្លៃ',
    'free + some at an unknown price': 'ឥតគិតថ្លៃ + ខ្លះមិនដឹងតម្លៃ',
    free: 'ឥតគិតថ្លៃ',
    '{count} tokens': '{count} តូខឹន',
    'Model: {assistant} · {model}': 'ម៉ូដែល៖ {assistant} · {model}',
    '{count} model round': 'ម៉ូដែលឆ្លើយ {count} ជុំ',
    '{count} model rounds': 'ម៉ូដែលឆ្លើយ {count} ជុំ',
    '{count} token in at the full rate': '{count} តូខឹនចូល តាមតម្លៃពេញ',
    '{count} tokens in at the full rate': '{count} តូខឹនចូល តាមតម្លៃពេញ',
    '{count} read from the cache': '{count} អានពីឃ្លាំងផ្ទុកបណ្ដោះអាសន្ន',
    '{count} written to it': '{count} សរសេរចូលឃ្លាំងនោះ',
    '{count} token out': '{count} តូខឹនចេញ',
    '{count} tokens out': '{count} តូខឹនចេញ',
    'About {dollars} at the list price. An estimate: the bill from your provider is the real figure.':
        'ប្រហែល {dollars} តាមតម្លៃផ្លូវការ។ នេះគ្រាន់តែជាការប៉ាន់ស្មាន៖ វិក្កយបត្រពីអ្នកផ្ដល់សេវារបស់អ្នក ទើបជាតួលេខពិត។',
    'About {dollars} at the list price, not counting {count} round on a model this app has no price for. An estimate: the bill from your provider is the real figure.':
        'ប្រហែល {dollars} តាមតម្លៃផ្លូវការ ដោយមិនរាប់ {count} ជុំ លើម៉ូដែលដែលកម្មវិធីនេះមិនដឹងតម្លៃ។ នេះគ្រាន់តែជាការប៉ាន់ស្មាន៖ វិក្កយបត្រពីអ្នកផ្ដល់សេវារបស់អ្នក ទើបជាតួលេខពិត។',
    'About {dollars} at the list price, not counting {count} rounds on a model this app has no price for. An estimate: the bill from your provider is the real figure.':
        'ប្រហែល {dollars} តាមតម្លៃផ្លូវការ ដោយមិនរាប់ {count} ជុំ លើម៉ូដែលដែលកម្មវិធីនេះមិនដឹងតម្លៃ។ នេះគ្រាន់តែជាការប៉ាន់ស្មាន៖ វិក្កយបត្រពីអ្នកផ្ដល់សេវារបស់អ្នក ទើបជាតួលេខពិត។',
    'This app has no list price for the model that answered, so it cannot put a figure on the cost.':
        'កម្មវិធីនេះមិនមានតម្លៃផ្លូវការសម្រាប់ម៉ូដែលដែលបានឆ្លើយទេ ដូច្នេះវាមិនអាចប្រាប់ថ្លៃជាតួលេខបានទេ។',
    'Answered by a free service, so nothing was charged.':
        'បានឆ្លើយដោយសេវាឥតគិតថ្លៃ ដូច្នេះមិនបានគិតថ្លៃអ្វីទេ។',
    'No limit': 'គ្មានដែនកំណត់',
    'paused · limit reached': 'បានផ្អាក · ដល់ដែនកំណត់',
    'paused · ≈ {dollars} this hour': 'បានផ្អាក · ≈ {dollars} ក្នុងម៉ោងនេះ',
    'paused · {count} call this hour': 'បានផ្អាក · ហៅ {count} ដងក្នុងម៉ោងនេះ',
    'paused · {count} calls this hour': 'បានផ្អាក · ហៅ {count} ដងក្នុងម៉ោងនេះ',
    '≈ {dollars} this hour': '≈ {dollars} ក្នុងម៉ោងនេះ',
    '{count} call this hour': 'ហៅ {count} ដងក្នុងម៉ោងនេះ',
    '{count} calls this hour': 'ហៅ {count} ដងក្នុងម៉ោងនេះ',
    '≈ {dollars} of {limit} this hour': '≈ {dollars} នៃ {limit} ក្នុងម៉ោងនេះ',
    '{count} call of {limit} this hour':
        'ហៅ {count} ដង (ដែនកំណត់ {limit}) ក្នុងម៉ោងនេះ',
    '{count} calls of {limit} this hour':
        'ហៅ {count} ដង (ដែនកំណត់ {limit}) ក្នុងម៉ោងនេះ',
    '{limit} an hour': '{limit} ក្នុងមួយម៉ោង',
    'Nothing has been spent in the last hour.':
        'មិនបានចំណាយអ្វីទេ ក្នុងមួយម៉ោងចុងក្រោយនេះ។',
    'In the last hour: about {dollars} over {count} model call, across every tab of this window. An estimate at list price.':
        'ក្នុងមួយម៉ោងចុងក្រោយ៖ ប្រហែល {dollars} សម្រាប់ការហៅម៉ូដែល {count} ដង ក្នុងគ្រប់ការសន្ទនានៃបង្អួចនេះ។ ជាការប៉ាន់ស្មានតាមតម្លៃផ្លូវការ។',
    'In the last hour: about {dollars} over {count} model calls, across every tab of this window. An estimate at list price.':
        'ក្នុងមួយម៉ោងចុងក្រោយ៖ ប្រហែល {dollars} សម្រាប់ការហៅម៉ូដែល {count} ដង ក្នុងគ្រប់ការសន្ទនានៃបង្អួចនេះ។ ជាការប៉ាន់ស្មានតាមតម្លៃផ្លូវការ។',
    'In the last hour: about {dollars} over {count} model call, {unpriced} of them on a model with no list price here, across every tab of this window. An estimate at list price.':
        'ក្នុងមួយម៉ោងចុងក្រោយ៖ ប្រហែល {dollars} សម្រាប់ការហៅម៉ូដែល {count} ដង ដែលក្នុងនោះ {unpriced} ដងលើម៉ូដែលដែលគ្មានតម្លៃផ្លូវការនៅទីនេះ ក្នុងគ្រប់ការសន្ទនានៃបង្អួចនេះ។ ជាការប៉ាន់ស្មានតាមតម្លៃផ្លូវការ។',
    'In the last hour: about {dollars} over {count} model calls, {unpriced} of them on a model with no list price here, across every tab of this window. An estimate at list price.':
        'ក្នុងមួយម៉ោងចុងក្រោយ៖ ប្រហែល {dollars} សម្រាប់ការហៅម៉ូដែល {count} ដង ដែលក្នុងនោះ {unpriced} ដងលើម៉ូដែលដែលគ្មានតម្លៃផ្លូវការនៅទីនេះ ក្នុងគ្រប់ការសន្ទនានៃបង្អួចនេះ។ ជាការប៉ាន់ស្មានតាមតម្លៃផ្លូវការ។',
    'The money cap is off. The assistant still pauses after {count} model calls in one hour, which is more than a person asks for.':
        'ដែនកំណត់ថ្លៃត្រូវបានបិទ។ ជំនួយការនៅតែផ្អាក បន្ទាប់ពីហៅម៉ូដែល {count} ដងក្នុងមួយម៉ោង ដែលច្រើនជាងមនុស្សម្នាក់សួរ។',
    'When the assistant has spent about {limit} in one hour (or made {count} model calls), it pauses and asks before spending more, so a fault cannot run up the bill.':
        'ពេលជំនួយការចំណាយប្រហែល {limit} ក្នុងមួយម៉ោង (ឬហៅម៉ូដែល {count} ដង) វានឹងផ្អាក ហើយសួរអ្នកសិន មុននឹងចំណាយបន្ថែម ដូច្នេះកំហុសណាមួយមិនអាចធ្វើឲ្យថ្លៃកើនឡើងបានទេ។',
    'The assistant is PAUSED now: press Allow more to carry on.':
        'ឥឡូវនេះ ជំនួយការត្រូវបានផ្អាក៖ សូមចុច អនុញ្ញាតបន្ថែម ដើម្បីបន្ត។',
    'Press Allow more to carry on for another hour. Until then the built-in guide answers for free.':
        'សូមចុច អនុញ្ញាតបន្ថែម ដើម្បីបន្តមួយម៉ោងទៀត។ រហូតដល់ពេលនោះ មគ្គុទ្ទេសក៍ក្នុងកម្មវិធីនឹងឆ្លើយដោយឥតគិតថ្លៃ។',
    'Press Allow more to carry on for another hour, or raise the limit under Limit per hour at the top. Until then the built-in guide answers for free.':
        'សូមចុច អនុញ្ញាតបន្ថែម ដើម្បីបន្តមួយម៉ោងទៀត ឬដំឡើងដែនកំណត់នៅ ដែនកំណត់ក្នុងមួយម៉ោង ខាងលើ។ រហូតដល់ពេលនោះ មគ្គុទ្ទេសក៍ក្នុងកម្មវិធីនឹងឆ្លើយដោយឥតគិតថ្លៃ។',
    'I have paused the assistant: it has made {count} model calls in the last hour, which is more than a person would ask for, so something may be running away with your credit.':
        'ខ្ញុំបានផ្អាកជំនួយការ៖ វាបានហៅម៉ូដែល {count} ដងក្នុងមួយម៉ោងចុងក្រោយ ដែលច្រើនជាងមនុស្សម្នាក់សួរ ដូច្នេះប្រហែលមានអ្វីមួយកំពុងចំណាយថ្លៃរបស់អ្នកដោយមិនឈប់។',
    'I have paused the assistant: it made {count} model calls within one hour, which is more than a person would ask for, so something may be running away with your credit.':
        'ខ្ញុំបានផ្អាកជំនួយការ៖ វាបានហៅម៉ូដែល {count} ដងក្នុងរយៈពេលមួយម៉ោង ដែលច្រើនជាងមនុស្សម្នាក់សួរ ដូច្នេះប្រហែលមានអ្វីមួយកំពុងចំណាយថ្លៃរបស់អ្នកដោយមិនឈប់។',
    'I have paused the assistant to protect your credit: it has spent about {dollars} in the last hour, which reaches the {limit} limit set for this window.':
        'ខ្ញុំបានផ្អាកជំនួយការ ដើម្បីការពារថ្លៃរបស់អ្នក៖ វាបានចំណាយប្រហែល {dollars} ក្នុងមួយម៉ោងចុងក្រោយ ដែលដល់ដែនកំណត់ {limit} ដែលបានកំណត់សម្រាប់បង្អួចនេះ។',
    'I have paused the assistant to protect your credit: within one hour it reached the {limit} limit set for this window.':
        'ខ្ញុំបានផ្អាកជំនួយការ ដើម្បីការពារថ្លៃរបស់អ្នក៖ ក្នុងរយៈពេលមួយម៉ោង វាបានដល់ដែនកំណត់ {limit} ដែលបានកំណត់សម្រាប់បង្អួចនេះ។',
    'Heads-up: about {dollars} of the {limit} hourly limit is used ({percent}%). At the limit I pause and ask before spending more; the guide keeps answering for free.':
        'សូមប្រយ័ត្ន៖ បានប្រើប្រហែល {dollars} នៃដែនកំណត់ {limit} ក្នុងមួយម៉ោងរួចហើយ ({percent}%)។ ពេលដល់ដែនកំណត់ ខ្ញុំនឹងផ្អាក ហើយសួរអ្នកសិន មុននឹងចំណាយបន្ថែម។ មគ្គុទ្ទេសក៍នៅតែឆ្លើយដោយឥតគិតថ្លៃ។',
    'Heads-up: {count} of the {max} model calls an hour are used. At the limit I pause and ask before spending more; the guide keeps answering for free.':
        'សូមប្រយ័ត្ន៖ បានប្រើការហៅម៉ូដែល {count} ដង ក្នុងចំណោម {max} ដងក្នុងមួយម៉ោងរួចហើយ។ ពេលដល់ដែនកំណត់ ខ្ញុំនឹងផ្អាក ហើយសួរអ្នកសិន មុននឹងចំណាយបន្ថែម។ មគ្គុទ្ទេសក៍នៅតែឆ្លើយដោយឥតគិតថ្លៃ។',
    'No assistant is answering in this tab — that came from the guide alone. An assistant usually answers better: pick one in the ASSISTANT list at the top of this window.':
        'គ្មានជំនួយការកំពុងឆ្លើយក្នុងការសន្ទនានេះទេ — ចម្លើយនោះមកពីមគ្គុទ្ទេសក៍តែប៉ុណ្ណោះ។ ជំនួយការជាធម្មតាឆ្លើយបានល្អជាង៖ សូមជ្រើសរើសមួយក្នុងបញ្ជី ជំនួយការ នៅខាងលើបង្អួចនេះ។',
    'A smarter model often gets right what this one did not. This tab is on Auto: pick an assistant by name in the ASSISTANT list at the top of this window, and the best model it has in the MODEL list beside it.':
        'ម៉ូដែលដែលឆ្លាតជាង ច្រើនតែឆ្លើយត្រូវ ក្នុងចំណុចដែលម៉ូដែលនេះឆ្លើយខុស។ ការសន្ទនានេះកំពុងប្រើ ស្វ័យប្រវត្តិ៖ សូមជ្រើសរើសជំនួយការតាមឈ្មោះក្នុងបញ្ជី ជំនួយការ នៅខាងលើបង្អួចនេះ ហើយជ្រើសម៉ូដែលល្អបំផុតរបស់វាក្នុងបញ្ជី ម៉ូដែល នៅក្បែរនោះ។',
    'This tab is already asking the best model {assistant} has ({model}), so a larger one is not the way out; another assistant in the ASSISTANT list at the top of this window may read it differently.':
        'ការសន្ទនានេះកំពុងសួរម៉ូដែលល្អបំផុតដែល {assistant} មាន ({model}) រួចហើយ ដូច្នេះម៉ូដែលធំជាងនេះមិនមែនជាដំណោះស្រាយទេ។ ជំនួយការផ្សេងទៀតក្នុងបញ្ជី ជំនួយការ នៅខាងលើបង្អួចនេះ អាចយល់វាខុសពីនេះ។',
    'A smarter model often gets right what this one did not. This tab is asking {asking}: try a larger model in the MODEL list at the top of this window, or another assistant in the ASSISTANT list beside it.':
        'ម៉ូដែលដែលឆ្លាតជាង ច្រើនតែឆ្លើយត្រូវ ក្នុងចំណុចដែលម៉ូដែលនេះឆ្លើយខុស។ ការសន្ទនានេះកំពុងសួរ {asking}៖ សូមសាកល្បងម៉ូដែលធំជាងនេះក្នុងបញ្ជី ម៉ូដែល នៅខាងលើបង្អួចនេះ ឬជំនួយការផ្សេងទៀតក្នុងបញ្ជី ជំនួយការ នៅក្បែរនោះ។',
    'A smarter model often gets right what this one did not. This tab is asking {asking}; {smarter} is the next one up.':
        'ម៉ូដែលដែលឆ្លាតជាង ច្រើនតែឆ្លើយត្រូវ ក្នុងចំណុចដែលម៉ូដែលនេះឆ្លើយខុស។ ការសន្ទនានេះកំពុងសួរ {asking}។ {smarter} គឺជាម៉ូដែលកម្រិតខ្ពស់បន្ទាប់។',
    'Ask again with {model}': 'សួរម្ដងទៀតជាមួយ {model}',
    'Ask it as a general question': 'សួរវាជាសំណួរទូទៅ',
    'You are welcome. When you want to find another verse, just tell me what you remember of it.':
        'មិនអីទេ។ ពេលណាចង់រកខគម្ពីរផ្សេងទៀត គ្រាន់តែប្រាប់ខ្ញុំពីអ្វីដែលអ្នកចាំអំពីវា។',
    'Sorry — that did not help. Tell me in your own words what you were trying to do, or what went wrong, and I will look into it.':
        'សូមទោស — នោះមិនបានជួយទេ។ សូមប្រាប់ខ្ញុំតាមពាក្យរបស់អ្នកផ្ទាល់ ថាអ្នកចង់ធ្វើអ្វី ឬមានអ្វីខុស ហើយខ្ញុំនឹងពិនិត្យមើល។',
    'Sorry — that answer did not help. Tell me what was wrong and I will look again: press one of these, or say it in your own words.':
        'សូមទោស — ចម្លើយនោះមិនបានជួយទេ។ សូមប្រាប់ខ្ញុំថាមានអ្វីខុស ហើយខ្ញុំនឹងពិនិត្យម្ដងទៀត៖ សូមចុចមួយក្នុងចំណោមទាំងនេះ ឬនិយាយតាមពាក្យរបស់អ្នកផ្ទាល់។',
    'Sorry — that answer did not help. Tell me what was wrong and I will look again.':
        'សូមទោស — ចម្លើយនោះមិនបានជួយទេ។ សូមប្រាប់ខ្ញុំថាមានអ្វីខុស ហើយខ្ញុំនឹងពិនិត្យម្ដងទៀត។',
    'Sorry — the answer to “{question}” did not help. Ask it again in other words, or tell me what was wrong, and I will look again.':
        'សូមទោស — ចម្លើយចំពោះ “{question}” មិនបានជួយទេ។ សូមសួរម្ដងទៀតដោយប្រើពាក្យផ្សេង ឬប្រាប់ខ្ញុំថាមានអ្វីខុស ហើយខ្ញុំនឹងពិនិត្យម្ដងទៀត។',
    'Only want to read the Bible? The Bible Reader page is made for that. Press Go to the Bible Reader below and the main window changes to it — whatever is on the projector is left as it is.':
        'គ្រាន់តែចង់អានព្រះគម្ពីរមែនទេ? ទំព័រ អានព្រះគម្ពីរ ត្រូវបានធ្វើឡើងសម្រាប់ការនោះ។ សូមចុច ទៅទំព័រអានព្រះគម្ពីរ ខាងក្រោម នោះបង្អួចមេនឹងប្ដូរទៅទំព័រនោះ — អ្វីដែលនៅលើម៉ាស៊ីនបញ្ចាំងនឹងនៅដដែល។',
    '{name} · main window': '{name} · បង្អួចមេ',
    '{name} · own window': '{name} · បង្អួចដាច់ដោយឡែក',
    'the picture could not be read': 'មិនអាចអានរូបភាពបានទេ',
    'the picture could not be redrawn': 'មិនអាចគូររូបភាពឡើងវិញបានទេ',
    'I could not do that just now. Try again in a moment.':
        'ខ្ញុំមិនអាចធ្វើវាបាននៅពេលនេះទេ។ សូមព្យាយាមម្ដងទៀតបន្តិចទៀត។',
    '{count} bytes': '{count} បៃ',
    'This file is not on this machine any more. It may have been moved, renamed or deleted.':
        'ឯកសារនេះលែងមាននៅលើកុំព្យូទ័រនេះទៀតហើយ។ វាប្រហែលជាត្រូវបានផ្លាស់ទី ប្ដូរឈ្មោះ ឬលុបចោល។',
    'This picture is {size}, too big to show here. Download it or open its folder to look at it.':
        'រូបភាពនេះមានទំហំ {size} ធំពេកក្នុងការបង្ហាញនៅទីនេះ។ សូមទាញយកវា ឬបើកថតរបស់វា ដើម្បីមើល។',
    'I could not read that picture from the disk.':
        'ខ្ញុំមិនអាចអានរូបភាពនោះពីថាសបានទេ។',
    'This file is {size}, too big to show here. Download it or open its folder to read it.':
        'ឯកសារនេះមានទំហំ {size} ធំពេកក្នុងការបង្ហាញនៅទីនេះ។ សូមទាញយកវា ឬបើកថតរបស់វា ដើម្បីអាន។',
    'I could not re-read the file, so this is the copy attached to your question.':
        'ខ្ញុំមិនអាចអានឯកសារម្ដងទៀតបានទេ ដូច្នេះនេះជាច្បាប់ចម្លងដែលបានភ្ជាប់ជាមួយសំណួររបស់អ្នក។',
    'I could not open that one: {reason}': 'ខ្ញុំមិនអាចបើកវាបានទេ៖ {reason}',
    'That picture is not attached any more — pictures are kept only while this window is open.':
        'រូបភាពនោះលែងភ្ជាប់ទៀតហើយ — រូបភាពត្រូវបានរក្សាទុក តែពេលបង្អួចនេះកំពុងបើកប៉ុណ្ណោះ។',
    'There is nothing left to show for that one.':
        'គ្មានអ្វីនៅសល់ដើម្បីបង្ហាញសម្រាប់វាទេ។',
    'That file is not on this machine any more, so there is nothing to download.':
        'ឯកសារនោះលែងមាននៅលើកុំព្យូទ័រនេះទៀតហើយ ដូច្នេះគ្មានអ្វីត្រូវទាញយកទេ។',
    '“{name}” is already in your Downloads folder — I opened it for you.':
        '“{name}” មាននៅក្នុងថតទាញយករបស់អ្នករួចហើយ — ខ្ញុំបានបើកវាឲ្យអ្នក។',
    'I could not save a copy into your Downloads folder.':
        'ខ្ញុំមិនអាចរក្សាទុកច្បាប់ចម្លងក្នុងថតទាញយករបស់អ្នកបានទេ។',
    'Saved “{name}” into your Downloads folder.':
        'បានរក្សាទុក “{name}” ក្នុងថតទាញយករបស់អ្នក។',
    'I could not save that picture.': 'ខ្ញុំមិនអាចរក្សាទុករូបភាពនោះបានទេ។',
    'Saved the picture into your Downloads folder.':
        'បានរក្សាទុករូបភាពក្នុងថតទាញយករបស់អ្នក។',
    'There is nothing left of that one to download.':
        'គ្មានអ្វីនៅសល់ពីវាដើម្បីទាញយកទេ។',
    '[... the rest is in the file ...]':
        '[... ផ្នែកដែលនៅសល់មាននៅក្នុងឯកសារ ...]',
    'Report: new': 'រាយការណ៍៖ ថ្មី',
    'Report: {words}': 'រាយការណ៍៖ {words}',
    'Alt+↑ brings back a question you asked before; Alt+↓ comes back to what you were typing.':
        'Alt+↑ នាំសំណួរដែលអ្នកបានសួរពីមុនមកវិញ។ Alt+↓ ត្រឡប់ទៅអ្វីដែលអ្នកកំពុងវាយ។',
    'Ctrl+Enter sends. Plain Enter starts a new line, so a long question can run across several.':
        'Ctrl+Enter ដើម្បីផ្ញើ។ Enter ធម្មតាចាប់ផ្ដើមបន្ទាត់ថ្មី ដូច្នេះសំណួរវែងអាចសរសេរបានច្រើនបន្ទាត់។',
    'While an answer is on its way, Send becomes Stop — and it really does call the question off.':
        'ពេលចម្លើយកំពុងមក ប៊ូតុង ផ្ញើ ក្លាយជា បញ្ឈប់ — ហើយវាពិតជាបញ្ឈប់សំណួរនោះមែន។',
    'You can keep typing while an answer is coming. Press Add and it joins the question being worked on.':
        'អ្នកអាចបន្តវាយ ពេលចម្លើយកំពុងមក។ ចុច បន្ថែម នោះវានឹងបញ្ចូលទៅក្នុងសំណួរដែលកំពុងដោះស្រាយ។',
    'The + above opens a second conversation. Each keeps its own assistant, model and answers.':
        'ប៊ូតុង + ខាងលើ បើកការសន្ទនាទីពីរ។ ការសន្ទនានីមួយៗមានជំនួយការ ម៉ូដែល និងចម្លើយរបស់ខ្លួន។',
    'Type / for commands that need no assistant: /screen-show turns the projector on, /screen-hide turns it off.':
        'វាយ / សម្រាប់ពាក្យបញ្ជាដែលមិនត្រូវការជំនួយការ៖ /screen-show បើកម៉ាស៊ីនបញ្ចាំង ហើយ /screen-hide បិទវា។',
    'Not about the app? Put /btw in front — /btw what is the Bible? — and that tab’s next question stays general.':
        'មិនមែនអំពីកម្មវិធីទេ? សូមដាក់ /btw នៅខាងមុខ — /btw ព្រះគម្ពីរជាអ្វី? — ហើយសំណួរបន្ទាប់ក្នុងការសន្ទនានោះ នៅតែជាសំណួរទូទៅ។',
    '/clear empties this chat. The projector’s clears are /screen-clear-all, /screen-clear-slide and friends.':
        '/clear សម្អាតការសន្ទនានេះ។ ការលុបលើម៉ាស៊ីនបញ្ចាំងគឺ /screen-clear-all /screen-clear-slide និងពាក្យបញ្ជាស្រដៀងគ្នា។',
    'Right-click a tab to rename it, or lock it so clearing the chats leaves that one alone.':
        'ចុចកណ្ដុរស្ដាំលើការសន្ទនាមួយ ដើម្បីកែឈ្មោះ ឬចាក់សោវា ដើម្បីកុំឲ្យការលុបការសន្ទនាប៉ះពាល់វា។',
    'The camera button attaches a picture of the app as it looks now — often quicker than describing it.':
        'ប៊ូតុងកាមេរ៉ាភ្ជាប់រូបភាពកម្មវិធីដូចដែលវាមើលទៅឥឡូវនេះ — ច្រើនតែលឿនជាងការពិពណ៌នា។',
    'The ◎ button points at a button in the app and asks what it does. Pointing at it does not press it.':
        'ប៊ូតុង ◎ ចង្អុលទៅប៊ូតុងមួយក្នុងកម្មវិធី ហើយសួរថាវាធ្វើអ្វី។ ការចង្អុលមិនមែនជាការចុចទេ។',
    'You can paste or drop a picture or a file straight into this window and ask about it.':
        'អ្នកអាចបិទភ្ជាប់ ឬទម្លាក់រូបភាព ឬឯកសារចូលក្នុងបង្អួចនេះផ្ទាល់ ហើយសួរអំពីវា។',
    'When an answer names a button, press that name and the app will outline the real one for you.':
        'ពេលចម្លើយនិយាយពីប៊ូតុងណាមួយ សូមចុចលើឈ្មោះនោះ នោះកម្មវិធីនឹងគូសបង្ហាញប៊ូតុងពិតឲ្យអ្នក។',
    'Ask to be shown step by step and the steps are drawn on a card in the app window itself.':
        'សុំឲ្យបង្ហាញម្តងមួយជំហាន នោះជំហាននានានឹងបង្ហាញលើកាតមួយ ក្នុងបង្អួចកម្មវិធីផ្ទាល់។',
    'If the app itself is wrong, press Report — it looks into it and writes the report up for you.':
        'ប្រសិនបើកម្មវិធីខ្លួនឯងមានបញ្ហា សូមចុច រាយការណ៍ — វានឹងពិនិត្យ ហើយសរសេររបាយការណ៍ឲ្យអ្នក។',
    'The “Asking about” picker at the top says which window the answers should be about.':
        'ប្រអប់ជ្រើស “កំពុងសួរអំពី” នៅខាងលើ ប្រាប់ថាចម្លើយគួរនិយាយអំពីបង្អួចណា។',
    'Type a few words and a list of questions it can already answer drops up; ↑ and ↓ walk it, Tab takes one.':
        'វាយពាក្យពីរបី នោះបញ្ជីសំណួរដែលវាអាចឆ្លើយបានរួចហើយនឹងលេចឡើង។ ↑ និង ↓ ដើរក្នុងបញ្ជី ហើយ Tab ជ្រើសយកមួយ។',
    'Every answer says what it cost; “Credit used” under the pickers totals this chat. Hover either for the sums.':
        'ចម្លើយនីមួយៗប្រាប់ថ្លៃរបស់វា។ “ថ្លៃដែលបានប្រើ” នៅក្រោមប្រអប់ជ្រើស បូកសរុបការសន្ទនានេះ។ ដាក់កណ្ដុរលើវា ដើម្បីមើលការគណនា។',
    'It cannot run up the bill: “Limit per hour” at the top pauses it at $1 an hour until you press Allow more.':
        'វាមិនអាចធ្វើឲ្យថ្លៃកើនឡើងដោយខ្លួនឯងបានទេ៖ “ដែនកំណត់ក្នុងមួយម៉ោង” នៅខាងលើ ផ្អាកវានៅ $1 ក្នុងមួយម៉ោង រហូតដល់អ្នកចុច អនុញ្ញាតបន្ថែម។',
    'Short of room? The arrow at the top left folds the pickers to one line; press the line to open them.':
        'ខ្វះកន្លែងមែនទេ? ព្រួញនៅខាងលើផ្នែកខាងឆ្វេង បត់ប្រអប់ជ្រើសទាំងអស់មកនៅមួយបន្ទាត់។ ចុចលើបន្ទាត់នោះ ដើម្បីបើកវាវិញ។',
    'A button it names is not there': 'ប៊ូតុងដែលវានិយាយ មិនមាននៅទីនោះទេ',
    'The steps did not work': 'ជំហាននានាមិនដំណើរការ',
    'That is wrong for the window I am in':
        'នោះមិនត្រូវនឹងបង្អួចដែលខ្ញុំកំពុងប្រើទេ',
    'Allow more': 'អនុញ្ញាតបន្ថែម',
    'Go to the Bible Reader': 'ទៅទំព័រអានព្រះគម្ពីរ',
    'You do not need to type the English book name.':
        'អ្នកមិនចាំបាច់វាយឈ្មោះគម្ពីរជាភាសាអង់គ្លេសទេ។',
    "1. Press **{clear}** to show the Bible's own book buttons.":
        '1. ចុច **{clear}** ដើម្បីបង្ហាញប៊ូតុងគម្ពីរនៃព្រះគម្ពីររបស់អ្នក។',
    "2. Press the book button for **{book}** in your Bible's own language, then press **Chapter {chapter}**.":
        '2. ចុចប៊ូតុងគម្ពីរ **{book}** ជាភាសានៃព្រះគម្ពីររបស់អ្នក រួចចុច **ជំពូក {chapter}**។',
    '3. Press **Verse {verse}** to open the passage.':
        '3. ចុច **ខ {verse}** ដើម្បីបើកបទគម្ពីរ។',
    'If the names use unfamiliar letters, press **{button}** below. It will handle one visible button at a time.':
        'បើឈ្មោះប្រើអក្សរដែលអ្នកមិនស្គាល់ សូមចុច **{button}** ខាងក្រោម។ វានឹងចុចប៊ូតុងដែលមើលឃើញម្តងមួយ។',
    'Do it for me': 'ធ្វើជំនួសខ្ញុំ',
    'in this window': 'នៅក្នុងបង្អួចនេះ',
    'This is done in the Presenter — the {page} page has none of these panels. First {route}, then:':
        'ការនេះធ្វើនៅក្នុងទំព័រធ្វើបទបង្ហាញ — ទំព័រ{page} មិនមានផ្ទាំងទាំងនេះទេ។ ជាដំបូង {route} បន្ទាប់មក៖',
    'click the 🖥️ **Go Back to Presenter** button at the top right':
        'ចុចប៊ូតុង 🖥️ **ត្រឡប់ទៅកម្មវិធីបង្ហាញ** នៅខាងលើស្ដាំ',
    'click the **Presenter** tab at the top of the window':
        'ចុចផ្ទាំង **ធ្វើបទបង្ហាញ** នៅខាងលើបង្អួច',
    '**{window} is not open**, so I cannot point at "{target}" in it. To get there: {how} — I have outlined it in red. Then ask me again.':
        '**{window} មិនទាន់បើកទេ** ដូច្នេះខ្ញុំមិនអាចចង្អុលទៅ "{target}" នៅក្នុងនោះបានទេ។ ដើម្បីទៅដល់៖ {how} — ខ្ញុំបានគូសរង្វង់វាជាពណ៌ក្រហមហើយ។ រួចសួរខ្ញុំម្តងទៀត។',
    '**{window} is not open**, so I cannot point at "{target}" in it. To get there: {how}. Then ask me again.':
        '**{window} មិនទាន់បើកទេ** ដូច្នេះខ្ញុំមិនអាចចង្អុលទៅ "{target}" នៅក្នុងនោះបានទេ។ ដើម្បីទៅដល់៖ {how}។ រួចសួរខ្ញុំម្តងទៀត។',
    'I could not find "{target}", but there is **{closest}** on screen — is that the one? Ask again with those words and I will point it out.':
        'ខ្ញុំរកមិនឃើញ "{target}" ទេ ប៉ុន្តែមាន **{closest}** នៅលើអេក្រង់ — តើវាជាមួយនោះឬ? សូមសួរម្តងទៀតដោយប្រើពាក្យទាំងនោះ ហើយខ្ញុំនឹងចង្អុលបង្ហាញវា។',
    'Highlight "{name}"': 'គូសរង្វង់ "{name}"',
    'I found "{target}" in the {window}, but it is not visible right now. Try opening the panel or tab it belongs to first.':
        'ខ្ញុំបានរកឃើញ "{target}" នៅក្នុង{window} ប៉ុន្តែឥឡូវនេះវាមិនបង្ហាញទេ។ សូមបើកផ្ទាំងដែលវាស្ថិតនៅជាមុនសិន។',
    '**{control}** is on screen now — I have outlined it in red for a few seconds, {where}.':
        '**{control}** មាននៅលើអេក្រង់ឥឡូវនេះ — ខ្ញុំបានគូសរង្វង់វាជាពណ៌ក្រហមពីរបីវិនាទី {where}។',
    'There are {count} things matching "{target}"; I outlined them all.':
        'មាន {count} ដែលត្រូវនឹង "{target}" ហើយខ្ញុំបានគូសរង្វង់ទាំងអស់។',
    '({count} in all — ask with more of the words on the control to narrow it down.)':
        '(សរុប {count} — សូមសួរដោយប្រើពាក្យច្រើនជាងនេះពីប៊ូតុងនោះ ដើម្បីរកឲ្យចំ។)',
    'Screen {id} is off but already holds {held}, so turning it on shows that.':
        'អេក្រង់ {id} បិទ ប៉ុន្តែមាន {held} រួចហើយ ដូច្នេះពេលបើកវានឹងបង្ហាញវា។',
    'No presentation screen is showing right now. This machine has {count} display(s) available to present on.':
        'ឥឡូវនេះគ្មានអេក្រង់បង្ហាញណាមួយកំពុងបង្ហាញទេ។ កុំព្យូទ័រនេះមានម៉ូនីទ័រ {count} ដែលអាចប្រើបង្ហាញបាន។',
    'Screen {ids} is showing right now, on a machine with {count} display(s){held}.':
        'អេក្រង់ {ids} កំពុងបង្ហាញឥឡូវនេះ នៅលើកុំព្យូទ័រដែលមានម៉ូនីទ័រ {count}{held}។',
    'Screen {ids} are showing right now, on a machine with {count} display(s){held}.':
        'អេក្រង់ {ids} កំពុងបង្ហាញឥឡូវនេះ នៅលើកុំព្យូទ័រដែលមានម៉ូនីទ័រ {count}{held}។',
    '**{reference} ({version})** reads -- "{words}".':
        '**{reference} ({version})** សរសេរថា -- "{words}"។',
    '**{reference} ({version})** reads.':
        '**{reference} ({version})** ត្រូវបានរកឃើញ។',
    'I can put it on the screen for you.': 'ខ្ញុំអាចដាក់វាលើអេក្រង់ឲ្យអ្នកបាន។',
    'I can put it on the screen for you -- the screen is off just now, so it will be loaded and ready for when it is turned on.':
        'ខ្ញុំអាចដាក់វាលើអេក្រង់ឲ្យអ្នកបាន -- ឥឡូវនេះអេក្រង់បិទ ដូច្នេះវានឹងត្រូវរៀបចំទុក ហើយរួចរាល់សម្រាប់ពេលអេក្រង់បើក។',
    'Put {what} on the screen': 'ដាក់ {what} លើអេក្រង់',
    'a {minutes} minute countdown': 'ការរាប់ថយក្រោយ {minutes} នាទី',
    'a countdown to {time}': 'ការរាប់ថយក្រោយដល់ម៉ោង {time}',
    '**I can start {what} on the screen for you**.':
        '**ខ្ញុំអាចចាប់ផ្ដើម{what}លើអេក្រង់ឲ្យអ្នកបាន**។',
    '**I can start {what} on the screen for you** -- the screen is off just now, so it will be loaded and ready for when it is turned on.':
        '**ខ្ញុំអាចចាប់ផ្ដើម{what}លើអេក្រង់ឲ្យអ្នកបាន** -- ឥឡូវនេះអេក្រង់បិទ ដូច្នេះវានឹងត្រូវរៀបចំទុក ហើយរួចរាល់សម្រាប់ពេលអេក្រង់បើក។',
    'Start {what}': 'ចាប់ផ្ដើម{what}',
    'The selected song lives in the Presenter, and the main window is not on it right now.':
        'ចម្រៀងដែលបានជ្រើសស្ថិតនៅក្នុងទំព័រធ្វើបទបង្ហាញ ហើយឥឡូវនេះបង្អួចមេមិននៅលើទំព័រនោះទេ។',
    'The run sheet lives in the Presenter, and the main window is not on it right now.':
        'តារាងកម្មវិធីស្ថិតនៅក្នុងទំព័រធ្វើបទបង្ហាញ ហើយឥឡូវនេះបង្អួចមេមិននៅលើទំព័រនោះទេ។',
    'I wrote those words out as a song for the Lyric Editor.':
        'ខ្ញុំបានសរសេរពាក្យទាំងនោះជាចម្រៀងសម្រាប់កម្មវិធីកែសម្រួលទំនុកច្រៀង។',
    'that page': 'ទំព័រនោះ',
    'I could not read {site} just now. Check the address, or copy the words off the page and paste them here and I will write them out.':
        'ឥឡូវនេះខ្ញុំមិនអាចអាន {site} បានទេ។ សូមពិនិត្យអាសយដ្ឋាន ឬចម្លងពាក្យពីទំព័រនោះ ហើយបិទភ្ជាប់នៅទីនេះ ខ្ញុំនឹងសរសេរវាចេញ។',
    'I read {site} and wrote the song on it out for the Lyric Editor.':
        'ខ្ញុំបានអាន {site} ហើយសរសេរចម្រៀងដែលនៅលើនោះសម្រាប់កម្មវិធីកែសម្រួលទំនុកច្រៀង។',
    '{site} answered with a "checking your browser" page instead of the song. Open the page in your own browser once and try again, or copy the words off it and paste them here.':
        '{site} បានឆ្លើយតបដោយទំព័រ "កំពុងពិនិត្យកម្មវិធីរុករករបស់អ្នក" ជំនួសឲ្យចម្រៀង។ សូមបើកទំព័រនោះក្នុងកម្មវិធីរុករករបស់អ្នកម្តង ហើយព្យាយាមម្តងទៀត ឬចម្លងពាក្យពីទំព័រនោះ ហើយបិទភ្ជាប់នៅទីនេះ។',
    'I read {site} but could not find a song on it. If the words are in front of you, paste them here and I will write them out.':
        'ខ្ញុំបានអាន {site} ប៉ុន្តែរកមិនឃើញចម្រៀងនៅលើនោះទេ។ បើអ្នកមានពាក្យនៅនឹងមុខ សូមបិទភ្ជាប់នៅទីនេះ ខ្ញុំនឹងសរសេរវាចេញ។',
    'I could not look up "{title}" just now. Paste its words here, or send me the address of a page with the song on it, and I will write it out.':
        'ឥឡូវនេះខ្ញុំមិនអាចស្វែងរក "{title}" បានទេ។ សូមបិទភ្ជាប់ពាក្យរបស់វានៅទីនេះ ឬផ្ញើអាសយដ្ឋានទំព័រដែលមានចម្រៀងនោះមកខ្ញុំ ខ្ញុំនឹងសរសេរវាចេញ។',
    'You already have {names} in your Documents list.':
        'អ្នកមាន {names} នៅក្នុងបញ្ជីឯកសាររបស់អ្នករួចហើយ។',
    'I found "{title}" in the app\'s collection of public-domain hymns and wrote it out for the Lyric Editor, with a link back to where the words came from.':
        'ខ្ញុំបានរកឃើញ "{title}" នៅក្នុងបណ្ដុំទំនុកតម្កើងសាធារណៈរបស់កម្មវិធី ហើយសរសេរវាសម្រាប់កម្មវិធីកែសម្រួលទំនុកច្រៀង ជាមួយតំណភ្ជាប់ទៅកន្លែងដែលពាក្យទាំងនោះមកពី។',
    'I could not find "{title}" in your songs or in the app\'s collection of public-domain hymns.':
        'ខ្ញុំរកមិនឃើញ "{title}" នៅក្នុងចម្រៀងរបស់អ្នក ឬក្នុងបណ្ដុំទំនុកតម្កើងសាធារណៈរបស់កម្មវិធីទេ។',
    'Did you mean {names}? Ask again with that name.':
        'តើអ្នកចង់និយាយថា {names} មែនទេ? សូមសួរម្តងទៀតដោយប្រើឈ្មោះនោះ។',
    'For any other song, paste its words here, or send me the address of a page with the song on it, and I will write it out. I do not write songs out from memory -- a remembered song is often wrong.':
        'សម្រាប់ចម្រៀងផ្សេងទៀត សូមបិទភ្ជាប់ពាក្យរបស់វានៅទីនេះ ឬផ្ញើអាសយដ្ឋានទំព័រដែលមានចម្រៀងនោះមកខ្ញុំ ខ្ញុំនឹងសរសេរវាចេញ។ ខ្ញុំមិនសរសេរចម្រៀងពីការចងចាំទេ -- ចម្រៀងដែលចាំបានច្រើនតែខុស។',
    'The words did not say everything, so I guessed:':
        'ពាក្យទាំងនោះមិនបានប្រាប់គ្រប់យ៉ាងទេ ដូច្នេះខ្ញុំបានទាយ៖',
    'Press Create "{name}" to add it to your songs, or Copy song text to paste it into the Lyric Editor yourself.':
        'ចុច បង្កើត "{name}" ដើម្បីបន្ថែមវាទៅក្នុងចម្រៀងរបស់អ្នក ឬចុច ចម្លងអត្ថបទចម្រៀង ដើម្បីបិទភ្ជាប់វាទៅក្នុងកម្មវិធីកែសម្រួលទំនុកច្រៀងដោយខ្លួនឯង។',
    'I could not find that in the app guide. Try naming the button or the thing you want to put on the screen — for example "how do I show a song?" or "where is the clear button?".':
        'ខ្ញុំរកមិនឃើញរឿងនោះក្នុងសៀវភៅណែនាំកម្មវិធីទេ។ សូមព្យាយាមប្រាប់ឈ្មោះប៊ូតុង ឬរបស់ដែលអ្នកចង់ដាក់លើអេក្រង់ — ឧទាហរណ៍ "តើខ្ញុំបង្ហាញចម្រៀងដោយរបៀបណា?" ឬ "តើប៊ូតុងលុបនៅឯណា?"។',
    'Ask me how to do something in the app.':
        'សូមសួរខ្ញុំពីរបៀបធ្វើអ្វីមួយក្នុងកម្មវិធី។',
    'Alright. Ask me again whenever you need something.':
        'យល់ហើយ។ សូមសួរខ្ញុំម្តងទៀតគ្រប់ពេលដែលអ្នកត្រូវការ។',
    'Tell me in a few words what you would like to do and I will look it up — for example "how do I show a screen".':
        'សូមប្រាប់ខ្ញុំដោយពាក្យខ្លីៗថាអ្នកចង់ធ្វើអ្វី ខ្ញុំនឹងស្វែងរកវា — ឧទាហរណ៍ "តើខ្ញុំបង្ហាញអេក្រង់ដោយរបៀបណា"។',
    'Going back to "{question}" —': 'ត្រឡប់ទៅ "{question}" វិញ —',
    '**Opening {window} for you.**': '**កំពុងបើក{window}ឲ្យអ្នក។**',
    '**Open {window} first.** It is {how}. When it is showing, come back here and press **{start}**.':
        '**សូមបើក{window}ជាមុនសិន។** វាគឺ {how}។ ពេលវាបង្ហាញហើយ សូមត្រឡប់មកទីនេះវិញ ហើយចុច **{start}**។',
    '**Open {window} first.** It is {how} — I have outlined it in red. When it is showing, come back here and press **{start}**.':
        '**សូមបើក{window}ជាមុនសិន។** វាគឺ {how} — ខ្ញុំបានគូសរង្វង់វាជាពណ៌ក្រហមហើយ។ ពេលវាបង្ហាញហើយ សូមត្រឡប់មកទីនេះវិញ ហើយចុច **{start}**។',
    'Done.': 'រួចរាល់។',
    'I could not start the walkthrough for that one. The written steps above still work.':
        'ខ្ញុំមិនអាចចាប់ផ្ដើមការណែនាំម្តងមួយជំហានសម្រាប់រឿងនោះបានទេ។ ជំហានដែលសរសេរខាងលើនៅតែប្រើបាន។',
    '**Look at the app window.** I am pointing to the right place now. Give me a moment to prepare the safe **{act}** step for the controls on your screen.':
        '**សូមមើលបង្អួចកម្មវិធី។** ឥឡូវនេះខ្ញុំកំពុងចង្អុលទៅកន្លែងត្រឹមត្រូវ។ សូមរង់ចាំបន្តិច ខ្ញុំកំពុងរៀបចំជំហាន **{act}** ដែលមានសុវត្ថិភាព សម្រាប់ប៊ូតុងនៅលើអេក្រង់របស់អ្នក។',
    '**Look at the app window.** A card is up. Some of its steps are not buttons I can point at, so give me a moment and I will work out the real ones.':
        '**សូមមើលបង្អួចកម្មវិធី។** ប័ណ្ណណែនាំបានបង្ហាញហើយ។ ជំហានខ្លះមិនមែនជាប៊ូតុងដែលខ្ញុំអាចចង្អុលបានទេ ដូច្នេះសូមរង់ចាំបន្តិច ខ្ញុំនឹងរកជំហានពិតប្រាកដ។',
    '**Look at the app window.** I cannot press this one for you — its steps are things to do in the page itself, not buttons. A card is showing step 1 of {count}; press **{next}** on it as you go.':
        '**សូមមើលបង្អួចកម្មវិធី។** ខ្ញុំមិនអាចចុចរឿងនេះជំនួសអ្នកបានទេ — ជំហានរបស់វាជាការងារដែលត្រូវធ្វើនៅក្នុងទំព័រផ្ទាល់ មិនមែនប៊ូតុងទេ។ ប័ណ្ណណែនាំកំពុងបង្ហាញជំហានទី 1 នៃ {count} សូមចុច **{next}** នៅលើវាពេលអ្នកធ្វើតាម។',
    '**Look at the app window.** A card is showing step 1 of {count}. Press **{act}** and I will do that step for you, one step per press — or **{skip}** to do it yourself. **✕** stops.':
        '**សូមមើលបង្អួចកម្មវិធី។** ប័ណ្ណណែនាំកំពុងបង្ហាញជំហានទី 1 នៃ {count}។ ចុច **{act}** ហើយខ្ញុំនឹងធ្វើជំហាននោះឲ្យអ្នក មួយជំហានក្នុងមួយការចុច — ឬចុច **{skip}** ដើម្បីធ្វើវាដោយខ្លួនឯង។ **✕** គឺបញ្ឈប់។',
    '**Look at the app window.** A card is showing step 1 of {count}, and the button that step is about is circled in red. Press **{next}** on the card when you have done it — or just do it, and the card moves on by itself.':
        '**សូមមើលបង្អួចកម្មវិធី។** ប័ណ្ណណែនាំកំពុងបង្ហាញជំហានទី 1 នៃ {count} ហើយប៊ូតុងរបស់ជំហាននោះត្រូវបានគូសរង្វង់ពណ៌ក្រហម។ ចុច **{next}** នៅលើប័ណ្ណពេលអ្នកធ្វើរួច — ឬគ្រាន់តែធ្វើវា ហើយប័ណ្ណនឹងបន្តដោយខ្លួនឯង។',
    'I could not find "{text}" on screen just now. Open the panel or tab it belongs to, then ask again.':
        'ឥឡូវនេះខ្ញុំរកមិនឃើញ "{text}" នៅលើអេក្រង់ទេ។ សូមបើកផ្ទាំងដែលវាស្ថិតនៅ រួចសួរម្តងទៀត។',
    'I have outlined **{control}** again, {where}.':
        'ខ្ញុំបានគូសរង្វង់ **{control}** ម្តងទៀត {where}។',
    'I could not do that just now. Ask me again, or tell me what you are trying to do and I will find another way.':
        'ឥឡូវនេះខ្ញុំមិនអាចធ្វើរឿងនោះបានទេ។ សូមសួរខ្ញុំម្តងទៀត ឬប្រាប់ខ្ញុំថាអ្នកកំពុងព្យាយាមធ្វើអ្វី ខ្ញុំនឹងរកវិធីផ្សេង។',
    '(From the app guide, which is written in English.)':
        '(ពីសៀវភៅណែនាំកម្មវិធី ដែលសរសេរជាភាសាអង់គ្លេស។)',
    "I'm there — start it": 'ខ្ញុំនៅទីនោះហើយ — ចាប់ផ្ដើម',
    everything: 'អ្វីៗទាំងអស់',
    'the background': 'ផ្ទៃខាងក្រោយ',
    'the slide': 'ស្លាយ',
    'the Bible passage or long text': 'បទគម្ពីរ ឬអត្ថបទវែង',
    'the foreground (countdown, marquee, clock)':
        'ផ្ទៃខាងមុខ (រាប់ថយក្រោយ អក្សររត់ នាឡិកា)',
    'Screen {id} already holds {held}, so turning it on shows that.':
        'អេក្រង់ {id} មាន {held} រួចហើយ ដូច្នេះពេលបើកវានឹងបង្ហាញវា។',
    '**Nothing is showing on the projector.** The screen is off.':
        '**គ្មានអ្វីបង្ហាញលើម៉ាស៊ីនបញ្ចាំងទេ។** អេក្រង់បិទ។',
    '**Nothing is showing on the projector.** The screen is off, and this computer has {count} display to put it on.':
        '**គ្មានអ្វីបង្ហាញលើម៉ាស៊ីនបញ្ចាំងទេ។** អេក្រង់បិទ ហើយកុំព្យូទ័រនេះមានម៉ូនីទ័រ {count} សម្រាប់បង្ហាញ។',
    '**Nothing is showing on the projector.** The screen is off, and this computer has {count} displays to put it on.':
        '**គ្មានអ្វីបង្ហាញលើម៉ាស៊ីនបញ្ចាំងទេ។** អេក្រង់បិទ ហើយកុំព្យូទ័រនេះមានម៉ូនីទ័រ {count} សម្រាប់បង្ហាញ។',
    'Screen {id} shows {held}.': 'អេក្រង់ {id} បង្ហាញ {held}។',
    '**Screen {ids} is showing right now** -- the projector has the app on it.':
        '**អេក្រង់ {ids} កំពុងបង្ហាញឥឡូវនេះ** -- ម៉ាស៊ីនបញ្ចាំងកំពុងបង្ហាញកម្មវិធី។',
    '**Screen {ids} are showing right now** -- the projector has the app on it.':
        '**អេក្រង់ {ids} កំពុងបង្ហាញឥឡូវនេះ** -- ម៉ាស៊ីនបញ្ចាំងកំពុងបង្ហាញកម្មវិធី។',
    'Turning the screen on': 'កំពុងបើកអេក្រង់',
    '**The screen is already on** -- screen {ids} is showing.':
        '**អេក្រង់បើករួចហើយ** -- អេក្រង់ {ids} កំពុងបង្ហាញ។',
    'I could not find the screen button in this window. It is the leftmost icon on the screen preview card in the **Presenter** (or press **F5** there).':
        'ខ្ញុំរកមិនឃើញប៊ូតុងអេក្រង់នៅក្នុងបង្អួចនេះទេ។ វាជារូបតំណាងខាងឆ្វេងបំផុតនៅលើប័ណ្ណមើលអេក្រង់ជាមុន ក្នុងទំព័រ **ធ្វើបទបង្ហាញ** (ឬចុច **F5** នៅទីនោះ)។',
    '**The screen is on now** -- screen {ids} is showing.':
        '**អេក្រង់បើកហើយឥឡូវនេះ** -- អេក្រង់ {ids} កំពុងបង្ហាញ។',
    'I pressed the screen button, but the app still reports nothing showing. Look at the screen preview card in the Presenter: its leftmost icon turns the output on, and the **Display** button under it says which display it goes to.':
        'ខ្ញុំបានចុចប៊ូតុងអេក្រង់ហើយ ប៉ុន្តែកម្មវិធីនៅតែប្រាប់ថាគ្មានអ្វីបង្ហាញ។ សូមមើលប័ណ្ណមើលអេក្រង់ជាមុនក្នុងទំព័រធ្វើបទបង្ហាញ៖ រូបតំណាងខាងឆ្វេងបំផុតរបស់វាបើកការបង្ហាញ ហើយប៊ូតុង **ម៉ូនីទ័រ** នៅខាងក្រោមវាប្រាប់ថាវាបង្ហាញទៅម៉ូនីទ័រណា។',
    'Turning every screen off': 'កំពុងបិទអេក្រង់ទាំងអស់',
    '**The screen is already off** -- nothing is showing.':
        '**អេក្រង់បិទរួចហើយ** -- គ្មានអ្វីបង្ហាញទេ។',
    '**Every screen is off now.** The projector shows nothing from the app.':
        '**អេក្រង់ទាំងអស់បិទហើយឥឡូវនេះ។** ម៉ាស៊ីនបញ្ចាំងមិនបង្ហាញអ្វីពីកម្មវិធីទេ។',
    'I asked the app to hide its screens, but one still reports showing. The leftmost icon on its preview card in the Presenter turns it off (or **F5**).':
        'ខ្ញុំបានស្នើឲ្យកម្មវិធីលាក់អេក្រង់របស់វា ប៉ុន្តែមានមួយនៅតែប្រាប់ថាកំពុងបង្ហាញ។ រូបតំណាងខាងឆ្វេងបំផុតនៅលើប័ណ្ណមើលជាមុនរបស់វា ក្នុងទំព័រធ្វើបទបង្ហាញ នឹងបិទវា (ឬ **F5**)។',
    'Clearing {what}': 'កំពុងលុប{what}',
    '**The screen is off**, so there is nothing to clear -- the projector shows nothing from the app.':
        '**អេក្រង់បិទ** ដូច្នេះគ្មានអ្វីត្រូវលុបទេ -- ម៉ាស៊ីនបញ្ចាំងមិនបង្ហាញអ្វីពីកម្មវិធីទេ។',
    'The screen is off, so this only emptied what it was holding.':
        'អេក្រង់បិទ ដូច្នេះការនេះគ្រាន់តែលុបអ្វីដែលវាកំពុងរក្សាទុកប៉ុណ្ណោះ។',
    'I could not find the **{label}** button in this window. It is on the screen preview card in the **Presenter**, or press **{key}** there.':
        'ខ្ញុំរកមិនឃើញប៊ូតុង **{label}** នៅក្នុងបង្អួចនេះទេ។ វានៅលើប័ណ្ណមើលអេក្រង់ជាមុន ក្នុងទំព័រ **ធ្វើបទបង្ហាញ** ឬចុច **{key}** នៅទីនោះ។',
    'I pressed **{label}**, and the button looks the same afterwards -- it is only lit while there is {what} to clear, so there may have been nothing on that layer. Next time, **{key}** does the same.':
        'ខ្ញុំបានចុច **{label}** ហើយ ប៉ុន្តែប៊ូតុងនៅដដែលបន្ទាប់ពីចុច -- វាភ្លឺតែពេលមាន{what}ត្រូវលុបប៉ុណ្ណោះ ដូច្នេះប្រហែលជាគ្មានអ្វីនៅលើស្រទាប់នោះទេ។ លើកក្រោយ **{key}** ធ្វើដូចគ្នា។',
    '**Cleared {what}.**': '**បានលុប{what}ហើយ។**',
    'Tell me the words written on the control -- for example `/find Clear Long Text` -- and I will outline it in the app window.':
        'សូមប្រាប់ខ្ញុំពីពាក្យដែលសរសេរនៅលើប៊ូតុង -- ឧទាហរណ៍ `/find លុបអត្ថបទវែង` -- ហើយខ្ញុំនឹងគូសរង្វង់វានៅក្នុងបង្អួចកម្មវិធី។',
    'I could not find anything on screen reading "{words}". Try the exact words written on the button, or open the panel it belongs to first.':
        'ខ្ញុំរកមិនឃើញអ្វីនៅលើអេក្រង់ដែលសរសេរថា "{words}" ទេ។ សូមប្រើពាក្យដូចដែលសរសេរនៅលើប៊ូតុង ឬបើកផ្ទាំងដែលវាស្ថិតនៅជាមុនសិន។',
    'I could not look for "{words}" just now -- the app window may be busy. Try again in a moment.':
        'ឥឡូវនេះខ្ញុំមិនអាចស្វែងរក "{words}" បានទេ -- បង្អួចកម្មវិធីប្រហែលជារវល់។ សូមព្យាយាមម្តងទៀតបន្តិចទៀត។',
    'Say which page: `/goto presenter`, `/goto reader` or `/goto editor`.':
        'សូមប្រាប់ទំព័រ៖ `/goto presenter`, `/goto reader` ឬ `/goto editor`។',
    'Switching to the {page}': 'កំពុងប្ដូរទៅ{page}',
    '**You are already in the {page}.**': '**អ្នកនៅក្នុង{page}រួចហើយ។**',
    '**The main window is showing the {page} now.** The projector is untouched.':
        '**ឥឡូវនេះបង្អួចមេកំពុងបង្ហាញ{page}។** ម៉ាស៊ីនបញ្ចាំងមិនត្រូវបានប៉ះពាល់ទេ។',
    'I could not switch to the {page}. Click its tab in the header of the main window instead.':
        'ខ្ញុំមិនអាចប្ដូរទៅ{page}បានទេ។ សូមចុចផ្ទាំងរបស់វានៅផ្នែកខាងលើនៃបង្អួចមេជំនួសវិញ។',
    'Checking which window is in front': 'កំពុងពិនិត្យថាបង្អួចណានៅខាងមុខ',
    '**This tab works with the {window}, a window of its own** in {language}.':
        '**ការសន្ទនានេះធ្វើការជាមួយ{window} ដែលជាបង្អួចដាច់ដោយឡែក** ជា{language}។',
    '**This tab works with the {window}, a window of its own**.':
        '**ការសន្ទនានេះធ្វើការជាមួយ{window} ដែលជាបង្អួចដាច់ដោយឡែក**។',
    'The main window is on the {window}.': 'បង្អួចមេកំពុងនៅលើ{window}។',
    '**The main window is on the {window}** in {language}.':
        '**បង្អួចមេកំពុងនៅលើ{window}** ជា{language}។',
    '**The main window is on the {window}**.': '**បង្អួចមេកំពុងនៅលើ{window}**។',
    'Also open: {windows}.': 'ក៏បើកផងដែរ៖ {windows}។',
    'App version {version}.': 'កំណែកម្មវិធី {version}។',
    French: 'ភាសាបារាំង',
    'I could not search the guide just now. Ask the question in full and I will look it up.':
        'ឥឡូវនេះខ្ញុំមិនអាចស្វែងរកក្នុងសៀវភៅណែនាំបានទេ។ សូមសួរសំណួរឲ្យពេញលេញ ខ្ញុំនឹងស្វែងរកវា។',
    'Checking what is selected': 'កំពុងពិនិត្យអ្វីដែលបានជ្រើស',
    '**The main window is not on the Presenter**, and the selected song lives there.':
        '**បង្អួចមេមិននៅលើទំព័រធ្វើបទបង្ហាញទេ** ហើយចម្រៀងដែលបានជ្រើសស្ថិតនៅទីនោះ។',
    'Reading the run sheet': 'កំពុងអានតារាងកម្មវិធី',
    '**The main window is not on the Presenter**, and the run sheet lives there.':
        '**បង្អួចមេមិននៅលើទំព័រធ្វើបទបង្ហាញទេ** ហើយតារាងកម្មវិធីស្ថិតនៅទីនោះ។',
    'Putting the next slide on the screen': 'កំពុងដាក់ស្លាយបន្ទាប់លើអេក្រង់',
    'Putting the previous slide on the screen': 'កំពុងដាក់ស្លាយមុនលើអេក្រង់',
    '**The main window is not on the Presenter**, so there is no slide list to step through.':
        '**បង្អួចមេមិននៅលើទំព័រធ្វើបទបង្ហាញទេ** ដូច្នេះគ្មានបញ្ជីស្លាយសម្រាប់ប្ដូរទេ។',
    '**Nothing is selected in the Documents list.** Click a song there first.':
        '**គ្មានអ្វីត្រូវបានជ្រើសក្នុងបញ្ជីឯកសារទេ។** សូមចុចលើចម្រៀងមួយនៅទីនោះជាមុនសិន។',
    '**There is no next slide** -- "{name}" has nothing after this one.':
        '**គ្មានស្លាយបន្ទាប់ទេ** -- "{name}" គ្មានអ្វីបន្ទាប់ពីស្លាយនេះទេ។',
    '**There is no previous slide** -- none of "{name}" is on a screen yet, so there is nothing to go back from.':
        '**គ្មានស្លាយមុនទេ** -- គ្មានស្លាយណាមួយនៃ "{name}" នៅលើអេក្រង់នៅឡើយ ដូច្នេះគ្មានអ្វីត្រូវថយក្រោយទេ។',
    'I could not find slide {n} of "{name}" on the screen to press. Click it in the slide list instead.':
        'ខ្ញុំរកមិនឃើញស្លាយទី {n} នៃ "{name}" នៅលើអេក្រង់ដើម្បីចុចទេ។ សូមចុចវានៅក្នុងបញ្ជីស្លាយជំនួសវិញ។',
    'I pressed slide {n} of "{name}" but the app does not show it on a screen yet -- please look at the Mini Screen panel.':
        'ខ្ញុំបានចុចស្លាយទី {n} នៃ "{name}" ប៉ុន្តែកម្មវិធីមិនទាន់បង្ហាញវានៅលើអេក្រង់នៅឡើយ -- សូមមើលផ្ទាំងអេក្រង់តូច។',
    '**{slide} of "{name}" is on the screen now**':
        '**{slide} នៃ "{name}" នៅលើអេក្រង់ឥឡូវនេះ**',
    'The screen itself is off, so the projector is not showing it yet.':
        'អេក្រង់ខ្លួនឯងបិទ ដូច្នេះម៉ាស៊ីនបញ្ចាំងមិនទាន់បង្ហាញវានៅឡើយទេ។',
    'Slide {n} "{name}"': 'ស្លាយ {n} "{name}"',
    'Slide {n}': 'ស្លាយ {n}',
    'Its slides: {slides}.': 'ស្លាយរបស់វា៖ {slides}។',
    'Putting the slide on the screen': 'កំពុងដាក់ស្លាយលើអេក្រង់',
    'Say which slide of "{name}": `/slide 2` or `/slide verse 1`.':
        'សូមប្រាប់ស្លាយណាមួយនៃ "{name}"៖ `/slide 2` ឬ `/slide verse 1`។',
    '**"{name}" has no slide called "{words}".**':
        '**"{name}" គ្មានស្លាយឈ្មោះ "{words}" ទេ។**',
    '**{slide} of "{name}"** -- press the button and it goes on the screen':
        '**{slide} នៃ "{name}"** -- ចុចប៊ូតុង ហើយវានឹងឡើងលើអេក្រង់',
    'The screen is off, so it holds the slide until you turn it on.':
        'អេក្រង់បិទ ដូច្នេះវារក្សាស្លាយនោះទុករហូតដល់អ្នកបើកវា។',
    'Put slide {n} on the screen': 'ដាក់ស្លាយ {n} លើអេក្រង់',
    '**"{name}" has no slide to go on to.**':
        '**"{name}" គ្មានស្លាយបន្ទាប់ទៀតទេ។**',
    '**No slide of "{name}" is on a screen yet**, so there is none before it.':
        '**គ្មានស្លាយណាមួយនៃ "{name}" នៅលើអេក្រង់នៅឡើយទេ** ដូច្នេះគ្មានស្លាយមុនវាទេ។',
    '**Nothing to turn off.**': '**គ្មានអ្វីត្រូវបិទទេ។**',
    'Press the button to turn it off.': 'ចុចប៊ូតុងដើម្បីបិទវា។',
    '**The screen is already on.**': '**អេក្រង់បើករួចហើយ។**',
    'Press the button to turn it on.': 'ចុចប៊ូតុងដើម្បីបើកវា។',
    '**Say which passage** -- for example `/verse John 3:16` or `/verse Psalm 23:1-6`.':
        '**សូមប្រាប់បទគម្ពីរ** -- ឧទាហរណ៍ `/verse John 3:16` ឬ `/verse Psalm 23:1-6`។',
    'Putting {reference} on the screen': 'កំពុងដាក់ {reference} លើអេក្រង់',
    '**I could not put "{reference}" on the screen just now.** Write it as book, chapter and verse -- `/verse John 3:16` -- from the Presenter page.':
        '**ឥឡូវនេះខ្ញុំមិនអាចដាក់ "{reference}" លើអេក្រង់បានទេ។** សូមសរសេរជា គម្ពីរ ជំពូក និងខ -- `/verse John 3:16` -- ពីទំព័រធ្វើបទបង្ហាញ។',
    '**Say how long** -- `/countdown 5` for five minutes, `/countdown 10:30` to count down to a time, or `/countdown stop` to take it off.':
        '**សូមប្រាប់រយៈពេល** -- `/countdown 5` សម្រាប់ប្រាំនាទី `/countdown 10:30` ដើម្បីរាប់ថយក្រោយដល់ម៉ោងមួយ ឬ `/countdown stop` ដើម្បីដកវាចេញ។',
    'I could not take the countdown off just now. Press F10 (Clear Foreground) on the Presenter page.':
        'ឥឡូវនេះខ្ញុំមិនអាចដកការរាប់ថយក្រោយចេញបានទេ។ សូមចុច F10 (លុបផ្ទៃខាងមុខ) នៅលើទំព័រធ្វើបទបង្ហាញ។',
    'Starting a {minutes} minute countdown':
        'កំពុងចាប់ផ្ដើមរាប់ថយក្រោយ {minutes} នាទី',
    'Starting a countdown to {time}': 'កំពុងចាប់ផ្ដើមរាប់ថយក្រោយដល់ម៉ោង {time}',
    'I could not start the countdown just now. Try again from the Presenter page -- `/countdown 5`.':
        'ឥឡូវនេះខ្ញុំមិនអាចចាប់ផ្ដើមការរាប់ថយក្រោយបានទេ។ សូមព្យាយាមម្តងទៀតពីទំព័រធ្វើបទបង្ហាញ -- `/countdown 5`។',
    '**Say the words to scroll** -- `/{command} Please silence your phones`; `/{command} stop` takes it off.':
        '**សូមប្រាប់ពាក្យដែលត្រូវរត់** -- `/{command} សូមបិទសំឡេងទូរស័ព្ទ` ហើយ `/{command} stop` ដកវាចេញ។',
    'I could not take the message off just now. Press F10 (Clear Foreground) on the Presenter page.':
        'ឥឡូវនេះខ្ញុំមិនអាចដកសារនោះចេញបានទេ។ សូមចុច F10 (លុបផ្ទៃខាងមុខ) នៅលើទំព័រធ្វើបទបង្ហាញ។',
    'Putting a scrolling message along the top of the screen':
        'កំពុងដាក់អក្សររត់នៅខាងលើអេក្រង់',
    'Putting a scrolling message along the bottom of the screen':
        'កំពុងដាក់អក្សររត់នៅខាងក្រោមអេក្រង់',
    'I could not put the message on the screen just now. Try again from the Presenter page -- `/{command} <words>`.':
        'ឥឡូវនេះខ្ញុំមិនអាចដាក់សារនោះលើអេក្រង់បានទេ។ សូមព្យាយាមម្តងទៀតពីទំព័រធ្វើបទបង្ហាញ -- `/{command} <ពាក្យ>`។',
    '**Give me the song** -- its title (`/lyric Amazing Grace`), the address of the page it is on (`/lyric https://…`), or paste its words after the command. I will write it out for the Lyric Editor and offer a button that saves it; nothing is saved until you press it.':
        '**សូមឲ្យចម្រៀងមកខ្ញុំ** -- ចំណងជើងរបស់វា (`/lyric Amazing Grace`) អាសយដ្ឋានទំព័រដែលវានៅ (`/lyric https://…`) ឬបិទភ្ជាប់ពាក្យរបស់វាបន្ទាប់ពីពាក្យបញ្ជា។ ខ្ញុំនឹងសរសេរវាសម្រាប់កម្មវិធីកែសម្រួលទំនុកច្រៀង ហើយផ្ដល់ប៊ូតុងមួយដើម្បីរក្សាទុកវា។ គ្មានអ្វីត្រូវបានរក្សាទុកទេ រហូតដល់អ្នកចុចវា។',
    'the page': 'ទំព័រ',
    'Looking up “{title}”': 'កំពុងស្វែងរក “{title}”',
    'That did not read as the words of a song. Give me the address of the page it is on (`/lyric https://…`), or paste the words themselves, a line each, with a label like *Verse 1* or *Chorus* over each part.':
        'នោះមើលទៅមិនដូចពាក្យនៃចម្រៀងទេ។ សូមឲ្យអាសយដ្ឋានទំព័រដែលវានៅ (`/lyric https://…`) ឬបិទភ្ជាប់ពាក្យផ្ទាល់ មួយបន្ទាត់ៗ ដោយមានស្លាកដូចជា *Verse 1* ឬ *Chorus* នៅពីលើផ្នែកនីមួយៗ។',
    'I could not write that song out just now. Try again in a moment, or paste the words as plain lines.':
        'ឥឡូវនេះខ្ញុំមិនអាចសរសេរចម្រៀងនោះបានទេ។ សូមព្យាយាមម្តងទៀតបន្តិចទៀត ឬបិទភ្ជាប់ពាក្យជាបន្ទាត់ធម្មតា។',
    '`/{command}` works on the Presenter page, and this chat is asking about the {window}. Switch the main window to the Presenter, choose **{presenter}** under {askingAbout} at the top, and type it again.':
        '`/{command}` ប្រើបាននៅលើទំព័រធ្វើបទបង្ហាញ ហើយការសន្ទនានេះកំពុងសួរអំពី{window}។ សូមប្ដូរបង្អួចមេទៅទំព័រធ្វើបទបង្ហាញ ជ្រើស **{presenter}** នៅក្រោម {askingAbout} នៅខាងលើ ហើយវាយវាម្តងទៀត។',
    'Type `/clear` in the chat window to clear the chat in front of you.':
        'វាយ `/clear` ក្នុងបង្អួចជជែក ដើម្បីលុបការសន្ទនាដែលនៅខាងមុខអ្នក។',
    '**Say the question after /btw** -- `/btw What is the Bible?` -- and the assistant answers it from its own knowledge instead of looking in this app’s guide. It takes an assistant (a key in Settings → AI Providers, or a server of your own): the built-in guide cannot answer a general question.':
        '**សូមវាយសំណួរបន្ទាប់ពី /btw** -- `/btw តើព្រះគម្ពីរជាអ្វី?` -- ហើយជំនួយការនឹងឆ្លើយតាមចំណេះដឹងរបស់វា ជំនួសឲ្យការស្វែងរកក្នុងសៀវភៅណែនាំកម្មវិធីនេះ។ ការនេះត្រូវការជំនួយការ (API key មួយក្នុង ការកំណត់ → អ្នកផ្តល់សេវា AI ឬម៉ាស៊ីនមេផ្ទាល់ខ្លួន)៖ សៀវភៅណែនាំក្នុងកម្មវិធីមិនអាចឆ្លើយសំណួរទូទៅបានទេ។',
    '**On the Presenter page** (switch there first): {commands}.':
        '**នៅលើទំព័រធ្វើបទបង្ហាញ** (ប្ដូរទៅទីនោះជាមុនសិន)៖ {commands}។',
    '**Commands you can type** -- each one runs on the spot, with no assistant and no internet (except `/btw`, which puts a general question to the assistant):':
        '**ពាក្យបញ្ជាដែលអ្នកអាចវាយបាន** -- នីមួយៗដំណើរការភ្លាមៗ ដោយគ្មានជំនួយការ និងគ្មានអ៊ីនធឺណិត (លើកលែងតែ `/btw` ដែលសួរសំណួរទូទៅទៅជំនួយការ)៖',
    'Type `/` and the list appears as you type.':
        'វាយ `/` ហើយបញ្ជីនឹងបង្ហាញពេលអ្នកវាយ។',
    'Nothing has been spent in this chat yet: no question here has been put to an assistant. The figure appears under each answer, and **{credit}** under the pickers at the top keeps the total.':
        'ការសន្ទនានេះមិនទាន់ចំណាយអ្វីនៅឡើយទេ៖ មិនទាន់មានសំណួរណាត្រូវបានសួរទៅជំនួយការទេ។ តួលេខបង្ហាញនៅក្រោមចម្លើយនីមួយៗ ហើយ **{credit}** នៅក្រោមប្រអប់ជ្រើសនៅខាងលើ រក្សាចំនួនសរុប។',
    '**This chat so far: {cost} · {tokens} tokens.**':
        '**ការសន្ទនានេះរហូតមកដល់ពេលនេះ៖ {cost} · {tokens} តូខឹន។**',
    'Each tab keeps its own total; the same figure sits under **{credit}** at the top, and every answer carries its own.':
        'ការសន្ទនានីមួយៗរក្សាចំនួនសរុបរបស់ខ្លួន។ តួលេខដូចគ្នានេះនៅក្រោម **{credit}** នៅខាងលើ ហើយចម្លើយនីមួយៗមានតួលេខរបស់ខ្លួន។',
    'Type `/limit` to change the limit.': 'វាយ `/limit` ដើម្បីប្ដូរកម្រិត។',
    'Carrying on: the hour starts again from now.':
        'បន្តទៀត៖ ម៉ោងចាប់ផ្ដើមរាប់ឡើងវិញពីពេលនេះ។',
    'Carrying on: the hour starts again from now, with {limit} available before I pause again.':
        'បន្តទៀត៖ ម៉ោងចាប់ផ្ដើមរាប់ឡើងវិញពីពេលនេះ ដោយមាន {limit} អាចប្រើបាន មុនពេលខ្ញុំផ្អាកម្តងទៀត។',
    'I do not read "{words}" as a limit. Say a number of dollars an hour (`/limit 2`, `/limit 0.50`), `/limit off` to keep only the pace cap, or `/limit more` to carry on after a pause.':
        'ខ្ញុំមិនយល់ "{words}" ថាជាកម្រិតទេ។ សូមប្រាប់ចំនួនដុល្លារក្នុងមួយម៉ោង (`/limit 2`, `/limit 0.50`) `/limit off` ដើម្បីរក្សាតែកម្រិតចំនួនដង ឬ `/limit more` ដើម្បីបន្តបន្ទាប់ពីការផ្អាក។',
    '**The money cap is off.** The assistant will still pause after {count} model calls in one hour, which is more than a person asks for.':
        '**កម្រិតលុយត្រូវបានបិទ។** ជំនួយការនឹងនៅតែផ្អាកបន្ទាប់ពីការហៅម៉ូដែល {count} ដងក្នុងមួយម៉ោង ដែលច្រើនជាងអ្វីដែលមនុស្សម្នាក់សួរ។',
    '**The limit is now {limit} an hour.** At that point the assistant pauses and asks before spending more.':
        '**ឥឡូវនេះកម្រិតគឺ {limit} ក្នុងមួយម៉ោង។** ពេលដល់កម្រិតនោះ ជំនួយការនឹងផ្អាក ហើយសួរមុននឹងចំណាយបន្ថែម។',
    '**Limit: {limit} an hour.**': '**កម្រិត៖ {limit} ក្នុងមួយម៉ោង។**',
    'Change it with `/limit <dollars>` or the **{picker}** picker at the top ({choices}), or `/limit off` to keep only the pace cap.':
        'ប្ដូរវាដោយ `/limit <ដុល្លារ>` ឬប្រអប់ជ្រើស **{picker}** នៅខាងលើ ({choices}) ឬ `/limit off` ដើម្បីរក្សាតែកម្រិតចំនួនដង។',
    'I do not know a command called `/{name}`.':
        'ខ្ញុំមិនស្គាល់ពាក្យបញ្ជាឈ្មោះ `/{name}` ទេ។',
    'I could not do `/{name}` just now. Try again in a moment, or ask me in words and I will find another way.':
        'ឥឡូវនេះខ្ញុំមិនអាចធ្វើ `/{name}` បានទេ។ សូមព្យាយាមម្តងទៀតបន្តិចទៀត ឬសួរខ្ញុំជាពាក្យ ហើយខ្ញុំនឹងរកវិធីផ្សេង។',
    'I could not reach the app window just now. Try again in a moment.':
        'ឥឡូវនេះខ្ញុំមិនអាចភ្ជាប់ទៅបង្អួចកម្មវិធីបានទេ។ សូមព្យាយាមម្តងទៀតបន្តិចទៀត។',
    'Next time, **{key}** in the Presenter does the same.':
        'លើកក្រោយ **{key}** នៅក្នុងទំព័រធ្វើបទបង្ហាញ ធ្វើដូចគ្នា។',
    '**The main window is not on the Presenter**, so there is no slide list to choose from.':
        '**បង្អួចមេមិននៅលើទំព័រធ្វើបទបង្ហាញទេ** ដូច្នេះគ្មានបញ្ជីស្លាយសម្រាប់ជ្រើសទេ។',
    '**Nothing is selected in the Documents list.** Click the song there first, then ask again.':
        '**គ្មានអ្វីត្រូវបានជ្រើសក្នុងបញ្ជីឯកសារទេ។** សូមចុចលើចម្រៀងនៅទីនោះជាមុនសិន រួចសួរម្តងទៀត។',
    'The guide covers using the app and holds none of the Bible’s words — but the Bibles in this app do, and **Bible Find** searches them. Search for “{words}”. If nothing comes back, try fewer words: it looks for them as they are typed.':
        'សៀវភៅណែនាំនិយាយតែអំពីការប្រើកម្មវិធី ហើយគ្មានពាក្យនៃព្រះគម្ពីរទេ — ប៉ុន្តែព្រះគម្ពីរក្នុងកម្មវិធីនេះមាន ហើយមុខងារ **ស្វែងរក** ក្នុងព្រះគម្ពីរ អាចស្វែងរកពាក្យទាំងនោះបាន។ សូមស្វែងរក “{words}”។ បើគ្មានលទ្ធផលទេ សូមប្រើពាក្យតិចជាងនេះ៖ វាស្វែងរកពាក្យតាមដែលបានវាយ។',
    'That is a question about the Bible itself, and the guide only knows how to use this app. An assistant can answer it: ask with /btw in front — /btw {question} — and if none answers, pick one in the row above, or add a key in Settings → AI Providers.':
        'នោះជាសំណួរអំពីព្រះគម្ពីរផ្ទាល់ ហើយសៀវភៅណែនាំស្គាល់តែរបៀបប្រើកម្មវិធីនេះប៉ុណ្ណោះ។ ជំនួយការអាចឆ្លើយបាន៖ សូមសួរដោយដាក់ /btw នៅខាងមុខ — /btw {question} — ហើយបើគ្មានជំនួយការណាឆ្លើយទេ សូមជ្រើសមួយនៅជួរខាងលើ ឬបន្ថែម API key មួយក្នុង ការកំណត់ → អ្នកផ្តល់សេវា AI។',
    'The Bibles in this app can be searched too: **Bible Find** lists the verses that have the words you type — try “{words}”, and fewer words if nothing comes back. Press {button} below for where it is.':
        'ព្រះគម្ពីរក្នុងកម្មវិធីនេះក៏អាចស្វែងរកបានដែរ៖ មុខងារ **ស្វែងរក** ក្នុងព្រះគម្ពីរ បង្ហាញខគម្ពីរដែលមានពាក្យដែលអ្នកវាយ — សូមសាកល្បង “{words}” ហើយប្រើពាក្យតិចជាងនេះបើគ្មានលទ្ធផល។ ចុច {button} ខាងក្រោម ដើម្បីមើលថាវានៅឯណា។',
    'Show me Bible Find': 'បង្ហាញខ្ញុំពីការស្វែងរកក្នុងព្រះគម្ពីរ',
    'Open {provider} billing': 'បើកទំព័របង់ប្រាក់ {provider}',
    'Open {provider} usage limits': 'បើកកម្រិតប្រើប្រាស់ {provider}',
    'Open {provider} API keys': 'បើក API key របស់ {provider}',
    'Open {provider} workspaces': 'បើកកន្លែងធ្វើការរបស់ {provider}',
    '{provider} status page': 'ទំព័រស្ថានភាព {provider}',
    '{assistant} could not answer — {reason}.':
        '{assistant} មិនអាចឆ្លើយបានទេ — {reason}។',
    '{assistant} could not answer.': '{assistant} មិនអាចឆ្លើយបានទេ។',
    'nothing answered at its address — it is shared by openworship.app and may be switched off right now; try again later or pick another assistant':
        'គ្មានអ្វីឆ្លើយតបនៅអាសយដ្ឋានរបស់វាទេ — វាត្រូវបានចែករំលែកដោយ openworship.app ហើយប្រហែលជាត្រូវបានបិទនៅពេលនេះ; សូមព្យាយាមម្ដងទៀតពេលក្រោយ ឬជ្រើសជំនួយការផ្សេង',
    'its server is not answering — check that it is running on this computer':
        'ម៉ាស៊ីនមេរបស់វាមិនឆ្លើយតបទេ — សូមពិនិត្យថាវាកំពុងដំណើរការនៅលើកុំព្យូទ័រនេះ',
    'its server is not answering — check that the computer it runs on is on and awake, and that the server is running':
        'ម៉ាស៊ីនមេរបស់វាមិនឆ្លើយតបទេ — សូមពិនិត្យថាកុំព្យូទ័រដែលវាដំណើរការ បានបើក និងមិនកំពុងដេក ហើយម៉ាស៊ីនមេកំពុងដំណើរការ',
    'it went quiet in the middle of the question — it is shared by openworship.app and may be switched off right now; try again later or pick another assistant':
        'វាស្ងាត់ឈឹងនៅពាក់កណ្ដាលសំណួរ — វាត្រូវបានចែករំលែកដោយ openworship.app ហើយប្រហែលជាត្រូវបានបិទនៅពេលនេះ; សូមព្យាយាមម្ដងទៀតពេលក្រោយ ឬជ្រើសជំនួយការផ្សេង',
    'it went quiet in the middle of the question — check that its server is running':
        'វាស្ងាត់ឈឹងនៅពាក់កណ្ដាលសំណួរ — សូមពិនិត្យថាម៉ាស៊ីនមេរបស់វាកំពុងដំណើរការ',
    'it went quiet in the middle of the question — check that the computer it runs on is on and awake, and that its server is running':
        'វាស្ងាត់ឈឹងនៅពាក់កណ្ដាលសំណួរ — សូមពិនិត្យថាកុំព្យូទ័រដែលវាដំណើរការ បានបើក និងមិនកំពុងដេក ហើយម៉ាស៊ីនមេរបស់វាកំពុងដំណើរការ',
    'the server took too long to answer':
        'ម៉ាស៊ីនមេចំណាយពេលយូរពេកក្នុងការឆ្លើយ',
    '{tried} {assistant} answered instead.':
        '{tried} {assistant} បានឆ្លើយជំនួសវិញ។',
    '{failed} could not answer — looking for another assistant that costs nothing':
        '{failed} មិនអាចឆ្លើយបានទេ — កំពុងរកជំនួយការឥតគិតថ្លៃមួយទៀត',
    'Use Auto for this chat': 'ប្រើ ស្វ័យប្រវត្តិ សម្រាប់ការសន្ទនានេះ',
    'Use {assistant} for this chat': 'ប្រើ {assistant} សម្រាប់ការសន្ទនានេះ',
    'That assistant is not in the list any more. Pick one in the ASSISTANT list at the top of this window.':
        'ជំនួយការនោះលែងមាននៅក្នុងបញ្ជីទៀតហើយ។ សូមជ្រើសមួយក្នុងបញ្ជី ជំនួយការ នៅខាងលើវីនដូនេះ។',
    'This chat now uses Auto: at each question it picks the best assistant that costs nothing and can answer.':
        'ការសន្ទនានេះឥឡូវប្រើ ស្វ័យប្រវត្តិ៖ នៅរាល់សំណួរ វាជ្រើសជំនួយការល្អបំផុតដែលឥតគិតថ្លៃ ហើយអាចឆ្លើយបាន។',
    'This chat now uses {assistant}. Pick another in the ASSISTANT list at the top of this window to change it again.':
        'ការសន្ទនានេះឥឡូវប្រើ {assistant}។ ជ្រើសមួយផ្សេងក្នុងបញ្ជី ជំនួយការ នៅខាងលើវីនដូនេះ ដើម្បីប្ដូរវាម្ដងទៀត។',
    'Asking {name} instead': 'កំពុងសួរ {name} ជំនួសវិញ',
    '{tried} Auto asked {assistant} instead.':
        '{tried} ស្វ័យប្រវត្តិបានសួរ {assistant} ជំនួសវិញ។',
    'Auto asked {assistant} this time.':
        'លើកនេះ ស្វ័យប្រវត្តិបានសួរ {assistant}។',
    'the control I mean': 'ប៊ូតុងដែលខ្ញុំចង់និយាយ',
    'Show me step by step': 'បង្ហាញខ្ញុំម្តងមួយជំហាន',
    'Read the whole thing': 'អានទាំងស្រុង',
    'Turn the screen on': 'បើកអេក្រង់',
    'Hide every screen': 'លាក់អេក្រង់ទាំងអស់',
    'Turn every screen off': 'បិទអេក្រង់ទាំងអស់',
    'Clear everything on it': 'លុបអ្វីៗទាំងអស់នៅលើវា',
    'Go to the Presenter': 'ទៅទំព័រធ្វើបទបង្ហាញ',
    'Show the next slide': 'បង្ហាញស្លាយបន្ទាប់',
    'Back one slide': 'ថយក្រោយមួយស្លាយ',
    'Back one': 'ថយក្រោយមួយ',
    'Show its first slide': 'បង្ហាញស្លាយទីមួយរបស់វា',
    'Is the screen on?': 'តើអេក្រង់បើកឬទេ?',
    'Take it off again': 'ដកវាចេញវិញ',
    'Check the screen': 'ពិនិត្យអេក្រង់',
    'Copy song text': 'ចម្លងអត្ថបទចម្រៀង',
    'Create "{name}"': 'បង្កើត "{name}"',
    'Open AI settings': 'បើកការកំណត់ AI',
    'Document Editor': 'កម្មវិធីកែសម្រួលឯកសារ',
    'No thanks': 'ទេ អរគុណ',
    'Asking about': 'កំពុងសួរអំពី',
    'Credit used': 'ថ្លៃដែលបានប្រើ',
    'Limit per hour': 'ដែនកំណត់ក្នុងមួយម៉ោង',
    'from the Bible Reader it is the 🖥️ button at the top right; from the Document Editor it is the Presenter tab at the top':
        'ពីទំព័រអានព្រះគម្ពីរ គឺប៊ូតុង 🖥️ នៅខាងលើស្ដាំ ហើយពីកម្មវិធីកែសម្រួលឯកសារ គឺផ្ទាំងធ្វើបទបង្ហាញនៅខាងលើ',
    'the 📖 Bible Reader tab at the top of the window':
        'ផ្ទាំង 📖 អានព្រះគម្ពីរ នៅខាងលើបង្អួច',
    'the ✏️ Editor tab at the top of the window':
        'ផ្ទាំង ✏️ កម្មវិធីកែសម្រួល នៅខាងលើបង្អួច',
    'double-click a note in the Bible Notes panel':
        'ចុចពីរដងលើកំណត់ត្រាមួយ នៅក្នុងផ្ទាំងកំណត់ត្រាព្រះគម្ពីរ',
    'the ⚙️ button at the top right of the window':
        'ប៊ូតុង ⚙️ នៅខាងលើស្ដាំនៃបង្អួច',
    'in the Background panel, open Web and double-click a web page':
        'នៅក្នុងផ្ទាំងផ្ទៃខាងក្រោយ បើក វេបសាយ ហើយចុចពីរដងលើទំព័របណ្ដាញមួយ',
    'open a song from the Documents panel and press Edit':
        'បើកចម្រៀងមួយពីផ្ទាំងឯកសារ ហើយចុច កែសម្រួល',
    'the Tools menu → Local Web Share':
        'ម៉ឺនុយ ឧបករណ៍ → ចែករំលែកតាមបណ្ដាញមូលដ្ឋាន',
    'in the middle of the window': 'នៅកណ្ដាលបង្អួច',
    'at the top left of the window': 'នៅខាងលើឆ្វេងនៃបង្អួច',
    'at the top center of the window': 'នៅខាងលើកណ្ដាលនៃបង្អួច',
    'at the top right of the window': 'នៅខាងលើស្ដាំនៃបង្អួច',
    'at the middle left of the window': 'នៅកណ្ដាលខាងឆ្វេងនៃបង្អួច',
    'at the middle right of the window': 'នៅកណ្ដាលខាងស្ដាំនៃបង្អួច',
    'at the bottom left of the window': 'នៅខាងក្រោមឆ្វេងនៃបង្អួច',
    'at the bottom center of the window': 'នៅខាងក្រោមកណ្ដាលនៃបង្អួច',
    'at the bottom right of the window': 'នៅខាងក្រោមស្ដាំនៃបង្អួច',
    'Is anything showing on the projector?':
        'តើមានអ្វីបង្ហាញនៅលើម៉ាស៊ីនបញ្ចាំងទេ?',
    'Turn the presentation screen on': 'បើកអេក្រង់បង្ហាញ',
    'Turn every presentation screen off': 'បិទអេក្រង់បង្ហាញទាំងអស់',
    'Clear everything off the screen (F6)': 'លុបអ្វីៗទាំងអស់ចេញពីអេក្រង់ (F6)',
    'Clear the background (F7)': 'លុបផ្ទៃខាងក្រោយ (F7)',
    'Clear the slide (F8)': 'លុបស្លាយ (F8)',
    'Clear the Bible passage or long text (F9)': 'លុបបទគម្ពីរ ឬអត្ថបទវែង (F9)',
    'Clear the countdown, marquee and clock (F10)':
        'លុបការរាប់ថយក្រោយ អក្សររត់ និងនាឡិកា (F10)',
    'Clear this chat — every message in this tab':
        'លុបការសន្ទនានេះ — សារទាំងអស់ក្នុងការសន្ទនានេះ',
    'Outline a control in the app: /find Clear Long Text':
        'គូសរង្វង់ប៊ូតុងមួយក្នុងកម្មវិធី៖ /find លុបអត្ថបទវែង',
    'Switch the main window: /goto presenter, reader or editor':
        'ប្ដូរបង្អួចមេ៖ /goto presenter, reader ឬ editor',
    'Which window is in front, and the app version':
        'បង្អួចណានៅខាងមុខ និងកំណែកម្មវិធី',
    'Which song is selected, which slide is up, and what is next':
        'ចម្រៀងណាដែលបានជ្រើស ស្លាយណាកំពុងបង្ហាញ និងអ្វីបន្ទាប់',
    'Which run sheet is open, where the run is, and what is next':
        'តារាងកម្មវិធីណាកំពុងបើក ដំណើរការដល់ណា និងអ្វីបន្ទាប់',
    'Put the next slide of the selected song on the screen':
        'ដាក់ស្លាយបន្ទាប់នៃចម្រៀងដែលបានជ្រើសលើអេក្រង់',
    'Go back one slide': 'ថយក្រោយមួយស្លាយ',
    'Put one slide of the selected song up: /slide 3, /slide verse 1':
        'ដាក់ស្លាយមួយនៃចម្រៀងដែលបានជ្រើសលើអេក្រង់៖ /slide 3, /slide verse 1',
    'Put a Bible passage on the screen: /verse John 3:16':
        'ដាក់បទគម្ពីរលើអេក្រង់៖ /verse John 3:16',
    'Start a countdown on the screen: /countdown 5, or /countdown 10:30':
        'ចាប់ផ្ដើមរាប់ថយក្រោយលើអេក្រង់៖ /countdown 5 ឬ /countdown 10:30',
    'Scroll a message along the bottom: /marquee Silence your phones':
        'ដាក់អក្សររត់នៅខាងក្រោម៖ /marquee សូមបិទសំឡេងទូរស័ព្ទ',
    'Scroll a message along the top of the screen: /marquee-top Welcome':
        'ដាក់អក្សររត់នៅខាងលើអេក្រង់៖ /marquee-top សូមស្វាគមន៍',
    'Search the built-in guide without an assistant: /help clear bible':
        'ស្វែងរកក្នុងសៀវភៅណែនាំដោយគ្មានជំនួយការ៖ /help clear bible',
    'What this chat has cost so far': 'ការសន្ទនានេះបានចំណាយថ្លៃប៉ុន្មានហើយ',
    'See or set the hourly spending limit: /limit 2, /limit off':
        'មើល ឬកំណត់កម្រិតចំណាយក្នុងមួយម៉ោង៖ /limit 2, /limit off',
    'Write a song out from its title, a web page, or pasted words':
        'សរសេរចម្រៀងពីចំណងជើង ទំព័របណ្ដាញ ឬពាក្យដែលបានបិទភ្ជាប់',
    'Ask the assistant a general question, not about this app':
        'សួរជំនួយការនូវសំណួរទូទៅ ដែលមិនមែនអំពីកម្មវិធីនេះ',
    'List every command': 'បង្ហាញពាក្យបញ្ជាទាំងអស់',
    "The app's own help service did not respond. Try again in a moment; if it keeps happening, restart the app with View → Relaunch in the main window.":
        'សេវាជំនួយរបស់កម្មវិធីមិនបានឆ្លើយតបទេ។ សូមព្យាយាមម្ដងទៀតបន្តិចទៀត; បើវានៅតែកើតឡើង សូមចាប់ផ្ដើមកម្មវិធីឡើងវិញ ដោយប្រើ មើល → Relaunch នៅក្នុងបង្អួចមេ។',
    'That song is not held any more — this window has been reopened since. Send me the words again and I will write it out afresh.':
        'ចម្រៀងនោះលែងត្រូវបានរក្សាទុកទៀតហើយ — បង្អួចនេះត្រូវបានបើកឡើងវិញតាំងពីពេលនោះ។ សូមផ្ញើពាក្យចម្រៀងមកខ្ញុំម្ដងទៀត ខ្ញុំនឹងសរសេរវាឡើងវិញ។',
    'per 1M tokens (in/out)': 'ក្នុង 1M តូខឹន (ចូល/ចេញ)',
    'best answers': 'ចម្លើយល្អបំផុត',
    'good answers': 'ចម្លើយល្អ',
    'simple answers': 'ចម្លើយសាមញ្ញ',
    'good answers at the lowest cost, with the prompt cached':
        'ចម្លើយល្អ ថ្លៃទាបបំផុត ព្រោះការណែនាំត្រូវបានរក្សាទុកជាមុន',
    'good answers, the everyday pick': 'ចម្លើយល្អ ជម្រើសប្រចាំថ្ងៃ',
    'simple answers at a tenth of the price': 'ចម្លើយសាមញ្ញ ក្នុងថ្លៃមួយភាគដប់',
    'good answers, strong with tools': 'ចម្លើយល្អ ពូកែប្រើឧបករណ៍',
    'better answers, us-west-2 only': 'ចម្លើយល្អជាង មានតែនៅ us-west-2',
    'open model, lowest cost': 'ម៉ូដែលបើកចំហ ថ្លៃទាបបំផុត',
    'best answers, about five times the price of Terra':
        'ចម្លើយល្អបំផុត ថ្លៃប្រហែលប្រាំដងនៃ Terra',
    'older; Terra answers better for less':
        'ចាស់ជាង; Terra ឆ្លើយបានល្អជាង ក្នុងថ្លៃតិចជាង',
    'open model, lighter': 'ម៉ូដែលបើកចំហ ស្រាលជាង',
    'tiny, simple answers only': 'តូចណាស់ សម្រាប់តែចម្លើយសាមញ្ញ',
    'good answers, can see pictures': 'ចម្លើយល្អ អាចមើលរូបភាពបាន',
    'often busy': 'ជារឿយៗរវល់',
    slower: 'យឺតជាង',
    quick: 'លឿន',
    quickest: 'លឿនបំផុត',
    'slow when busy': 'យឺតពេលរវល់',
    'Answers are coming from a free public AI service ({service}), which needs no API key. Your questions and anything you attach leave this computer and may be kept by that service, so do not send anything private. Answers are also weaker, and can be slow or busy. Your own key in Settings gives better and more private answers.':
        'ចម្លើយកំពុងមកពីសេវា AI សាធារណៈឥតគិតថ្លៃ ({service}) ដែលមិនត្រូវការ API key។ សំណួររបស់អ្នក និងអ្វីៗដែលអ្នកភ្ជាប់ នឹងចេញពីកុំព្យូទ័រនេះ ហើយសេវានោះអាចរក្សាទុកវា ដូច្នេះកុំផ្ញើអ្វីដែលជាការឯកជន។ ចម្លើយក៏ខ្សោយជាង ហើយអាចយឺត ឬរវល់។ API key ផ្ទាល់ខ្លួនរបស់អ្នកនៅក្នុងការកំណត់ ផ្ដល់ចម្លើយល្អជាង និងឯកជនជាង។',
    'Auto picks an assistant that costs nothing for each question: one of your own servers when it is up to it, otherwise a free public AI service ({service}). When that service answers, your questions and anything you attach leave this computer and may be kept by it, so do not send anything private. A server of your own picked in the row above is asked first; when it cannot answer, the question goes on to your other servers and then to this service.':
        'ស្វ័យប្រវត្តិ ជ្រើសរើសជំនួយការដែលឥតគិតថ្លៃ សម្រាប់សំណួរនីមួយៗ៖ ម៉ាស៊ីនមេផ្ទាល់ខ្លួនរបស់អ្នក ពេលវាអាចឆ្លើយបាន បើមិនដូច្នោះទេ គឺសេវា AI សាធារណៈឥតគិតថ្លៃ ({service})។ ពេលសេវានោះឆ្លើយ សំណួររបស់អ្នក និងអ្វីៗដែលអ្នកភ្ជាប់ នឹងចេញពីកុំព្យូទ័រនេះ ហើយវាអាចរក្សាទុកបាន ដូច្នេះកុំផ្ញើអ្វីដែលជាការឯកជន។ ម៉ាស៊ីនមេផ្ទាល់ខ្លួនដែលអ្នកជ្រើសនៅជួរខាងលើ ត្រូវបានសួរមុនគេ។ ពេលវាមិនអាចឆ្លើយបាន សំណួរនឹងត្រូវបញ្ជូនទៅម៉ាស៊ីនមេផ្សេងទៀតរបស់អ្នក ហើយបន្ទាប់មកទៅសេវានេះ។',
    '{name}, shared by openworship.app': '{name} ចែករំលែកដោយ openworship.app',
    '{name}, on this computer': '{name} នៅលើកុំព្យូទ័រនេះ',
    '{name}, on your network': '{name} នៅលើបណ្ដាញរបស់អ្នក',
    'can see pictures': 'អាចមើលរូបភាពបាន',
    'it wrote no answer this time — a smaller question, or a larger model, usually helps':
        'លើកនេះវាមិនបានសរសេរចម្លើយទេ — សំណួរខ្លីជាង ឬម៉ូដែលធំជាង ជាធម្មតាអាចជួយបាន',
    'this API key needs a workspace id — add it in Settings → AI Providers':
        'API key នេះត្រូវការ workspace id — សូមបន្ថែមវានៅក្នុង ការកំណត់ → អ្នកផ្តល់សេវា AI',
    'the API key was refused — check it in Settings → AI Providers':
        'API key ត្រូវបានបដិសេធ — សូមពិនិត្យវានៅក្នុង ការកំណត់ → អ្នកផ្តល់សេវា AI',
    'the AI account is out of credit': 'គណនី AI អស់ទឹកប្រាក់ហើយ',
    'the AI account is being rate-limited (asked too often) — wait a minute and try again':
        'គណនី AI កំពុងត្រូវបានកំណត់ល្បឿន (សួរញឹកញាប់ពេក) — សូមរង់ចាំមួយនាទី ហើយព្យាយាមម្ដងទៀត',
    'the AI account is out of credit or being rate-limited':
        'គណនី AI អស់ទឹកប្រាក់ ឬកំពុងត្រូវបានកំណត់ល្បឿន',
    'the AI service is overloaded right now': 'សេវា AI កំពុងមមាញឹកខ្លាំងពេលនេះ',
    'the AI service is having trouble right now': 'សេវា AI កំពុងមានបញ្ហាពេលនេះ',
    'this model is not available to the account — pick another one in the row above':
        'ម៉ូដែលនេះមិនមានសម្រាប់គណនីនេះទេ — សូមជ្រើសមួយផ្សេងទៀតនៅជួរខាងលើ',
    'the server could not load this model — the computer it runs on may not have enough memory free. Pick a smaller model in the row above, or close another model there':
        'ម៉ាស៊ីនមេមិនអាចផ្ទុកម៉ូដែលនេះបានទេ — កុំព្យូទ័រដែលដំណើរការវាប្រហែលជាមិនមានអង្គចងចាំទំនេរគ្រប់គ្រាន់។ សូមជ្រើសម៉ូដែលតូចជាងនៅជួរខាងលើ ឬបិទម៉ូដែលមួយផ្សេងទៀតនៅលើកុំព្យូទ័រនោះ',
    'it could not be reached — the internet may be down':
        'មិនអាចភ្ជាប់ទៅវាបានទេ — អ៊ីនធឺណិតប្រហែលជាដាច់',
    'the AI service refused the request (error {status})':
        'សេវា AI បានបដិសេធសំណើ (កំហុស {status})',
    'To see what is on the projector or what is selected, the main window needs to be on the Presenter page — switch to it and ask again.':
        'ដើម្បីមើលអ្វីដែលនៅលើម៉ាស៊ីនបញ្ចាំង ឬអ្វីដែលបានជ្រើស បង្អួចមេត្រូវតែនៅលើទំព័រ ធ្វើបទបង្ហាញ — សូមប្ដូរទៅទំព័រនោះ ហើយសួរម្ដងទៀត។',
    'Thinking about it': 'កំពុងគិត',
    'Thinking it over ({count})': 'កំពុងគិតបន្ថែម ({count})',
    'I ran out of room working that out before I could answer. Try asking about one step at a time.':
        'ខ្ញុំអស់កន្លែងគិតមុនពេលអាចឆ្លើយបាន។ សូមសាកសួរម្ដងមួយជំហាន។',
    'I could not find an answer for that.':
        'ខ្ញុំរកមិនឃើញចម្លើយសម្រាប់សំណួរនោះទេ។',
    'I looked several things up but could not settle on an answer. Try asking about one step at a time.':
        'ខ្ញុំបានរកមើលរឿងជាច្រើន ប៉ុន្តែមិនអាចសម្រេចចម្លើយបានទេ។ សូមសាកសួរម្ដងមួយជំហាន។',
    'This assistant’s server cannot use the app’s tools, so this comes from the guide text alone and nothing was checked in the window — for presses and live answers, use LM Studio, Ollama or llama.cpp.':
        'ម៉ាស៊ីនមេរបស់ជំនួយការនេះមិនអាចប្រើឧបករណ៍របស់កម្មវិធីបានទេ ដូច្នេះចម្លើយនេះមកពីអត្ថបទមគ្គុទ្ទេសក៍តែប៉ុណ្ណោះ ហើយគ្មានអ្វីត្រូវបានពិនិត្យនៅក្នុងបង្អួចទេ — សម្រាប់ការចុច និងចម្លើយផ្ទាល់ សូមប្រើ LM Studio, Ollama ឬ llama.cpp។',
    '{first} or {last}': '{first} ឬ {last}',
    '{model} is not offered in {region} — choose {choices} under Settings → AI Providers → AWS Region':
        '{model} មិនមាននៅ {region} ទេ — សូមជ្រើស {choices} នៅ ការកំណត់ → អ្នកផ្តល់សេវា AI → តំបន់ AWS',
    'this model is no longer in Settings — pick another one in the row above':
        'ម៉ូដែលនេះលែងមាននៅក្នុងការកំណត់ទៀតហើយ — សូមជ្រើសមួយផ្សេងទៀតនៅជួរខាងលើ',
    'Waiting for {server} to load {model} — the first answer takes longer':
        'កំពុងរង់ចាំ {server} ផ្ទុក {model} — ចម្លើយដំបូងចំណាយពេលយូរជាង',
    '{server} is reading the instructions first — the first answer takes longer on a local model':
        '{server} កំពុងអានការណែនាំជាមុនសិន — ចម្លើយដំបូងចំណាយពេលយូរជាង នៅលើម៉ូដែលក្នុងម៉ាស៊ីន',
    'The walkthrough got stuck on step {number} of "{title}" — "{step}" — and asked for help.':
        'ការណែនាំជាជំហាន "{title}" បានជាប់គាំងនៅជំហានទី {number} — "{step}" — ហើយបានសុំជំនួយ។',
    'The walkthrough got stuck on step {number} — "{step}" — and asked for help.':
        'ការណែនាំជាជំហានបានជាប់គាំងនៅជំហានទី {number} — "{step}" — ហើយបានសុំជំនួយ។',
    'The walkthrough got stuck of "{title}" — "{step}" — and asked for help.':
        'ការណែនាំជាជំហាន "{title}" បានជាប់គាំង — "{step}" — ហើយបានសុំជំនួយ។',
    'The walkthrough got stuck — "{step}" — and asked for help.':
        'ការណែនាំជាជំហានបានជាប់គាំង — "{step}" — ហើយបានសុំជំនួយ។',
    'No AI provider key is set': 'មិនទាន់មាន API key របស់អ្នកផ្តល់សេវា AI ទេ',
    'There was no question to ask': 'គ្មានសំណួរសម្រាប់សួរទេ',
    'Connecting to the app': 'កំពុងភ្ជាប់ទៅកម្មវិធី',
    '{failed} could not answer — asking {other} instead':
        '{failed} មិនអាចឆ្លើយបានទេ — កំពុងសួរ {other} ជំនួសវិញ',
    'Show it in the list': 'បង្ហាញវានៅក្នុងបញ្ជី',
    'here {names}': 'នៅទីនេះ៖ {names}',
    'attachment {number}': 'ឯកសារភ្ជាប់ {number}',
    'I have written this up as "{title}". It carries {collected}. Copy report puts every word of it on your clipboard if you want to read it first. Press Send report when you want it filed — nothing goes anywhere until you do.':
        'ខ្ញុំបានសរសេរវាជារបាយការណ៍ "{title}"។ វាមាន {collected}។ ប៊ូតុង ចម្លងរបាយការណ៍ ដាក់ពាក្យទាំងអស់របស់វាទៅក្ដារតម្បៀតខ្ទាស់ ប្រសិនបើអ្នកចង់អានវាជាមុន។ សូមចុច ផ្ញើរបាយការណ៍ ពេលអ្នកចង់ផ្ញើវា — គ្មានអ្វីចេញទៅណាទេ រហូតដល់អ្នកចុច។',
    'Send report': 'ផ្ញើរបាយការណ៍',
    'Copy report': 'ចម្លងរបាយការណ៍',
    'Try this first:': 'សូមសាកល្បងវិធីនេះជាមុនសិន៖',
    'Did that solve it? If it did, nothing needs to be sent. If it did not, I have the report written up and ready.':
        'តើវាបានដោះស្រាយបញ្ហាទេ? បើបាន មិនចាំបាច់ផ្ញើអ្វីទេ។ បើមិនបានទេ ខ្ញុំបានសរសេររបាយការណ៍រួចរាល់ហើយ។',
    'That fixed it': 'វាបានដោះស្រាយហើយ',
    'Still a problem — report it': 'នៅតែមានបញ្ហា — រាយការណ៍វា',
    'Good. Nothing was sent, and this report is closed. If it comes back, press Report again and I will pick it up from here.':
        'ល្អ។ គ្មានអ្វីត្រូវបានផ្ញើទេ ហើយរបាយការណ៍នេះត្រូវបានបិទ។ បើបញ្ហាកើតឡើងម្ដងទៀត សូមចុច រាយការណ៍ ម្ដងទៀត ខ្ញុំនឹងបន្តពីទីនេះ។',
    "the app's version and build, this computer's system information (operating system, language, time zone, display scale), the window you are in and what is selected, what each screen holds, the app's console log (its recent errors and warnings), the end of this conversation, a picture of the app and any file you attach":
        'កំណែ និងលេខស្ថាបនារបស់កម្មវិធី ព័ត៌មានប្រព័ន្ធរបស់កុំព្យូទ័រនេះ (ប្រព័ន្ធប្រតិបត្តិការ ភាសា តំបន់ម៉ោង ទំហំបង្ហាញ) បង្អួចដែលអ្នកកំពុងប្រើ និងអ្វីដែលបានជ្រើស អ្វីដែលអេក្រង់នីមួយៗកំពុងបង្ហាញ កំណត់ហេតុរបស់កម្មវិធី (កំហុស និងការព្រមានថ្មីៗ) ចុងបញ្ចប់នៃការសន្ទនានេះ រូបភាពនៃកម្មវិធី និងឯកសារណាមួយដែលអ្នកភ្ជាប់',
    'I will look at the app myself and write it up for the people who maintain the app. The report carries {collected}. Nothing is sent until you then press Send report.':
        'ខ្ញុំនឹងពិនិត្យមើលកម្មវិធីដោយខ្លួនឯង ហើយសរសេររបាយការណ៍សម្រាប់អ្នកថែទាំកម្មវិធី។ របាយការណ៍មាន {collected}។ គ្មានអ្វីត្រូវបានផ្ញើទេ រហូតដល់អ្នកចុច ផ្ញើរបាយការណ៍។',
    'Tell me what went wrong — or what you wish the app did better — in the box below, in your own words, and attach a picture or a file (a PDF, a text file) if it helps. Then press Send or Report — either starts it: {promise}':
        'សូមប្រាប់ខ្ញុំថាមានបញ្ហាអ្វី — ឬអ្វីដែលអ្នកចង់ឱ្យកម្មវិធីធ្វើបានល្អជាងនេះ — នៅក្នុងប្រអប់ខាងក្រោម តាមពាក្យរបស់អ្នកផ្ទាល់ ហើយភ្ជាប់រូបភាព ឬឯកសារ (PDF ឬឯកសារអក្សរ) បើវាជួយបាន។ បន្ទាប់មកចុច ផ្ញើ ឬ រាយការណ៍ — មួយណាក៏ចាប់ផ្ដើមបានដែរ៖ {promise}',
    Report: 'រាយការណ៍',
    'The app ran into a problem:': 'កម្មវិធីបានជួបបញ្ហា៖',
    'Press Report to let me look into it: {promise} If you remember what you were doing when it happened, type that in the box instead and press Send — it goes into the report, and so does a picture or a file you attach.':
        'សូមចុច រាយការណ៍ ដើម្បីឱ្យខ្ញុំពិនិត្យមើល៖ {promise} បើអ្នកចាំថាអ្នកកំពុងធ្វើអ្វីពេលវាកើតឡើង សូមវាយវាក្នុងប្រអប់ជំនួសវិញ ហើយចុច ផ្ញើ — វានឹងចូលទៅក្នុងរបាយការណ៍ ហើយរូបភាព ឬឯកសារដែលអ្នកភ្ជាប់ក៏ដូចគ្នាដែរ។',
    "from the app's help page": 'ពីទំព័រជំនួយរបស់កម្មវិធី',
    'the address built into the app; its help page could not be checked':
        'អាសយដ្ឋានដែលមានស្រាប់ក្នុងកម្មវិធី; មិនអាចពិនិត្យទំព័រជំនួយរបស់វាបានទេ',
    'give it this subject line (**Copy subject** copies it):':
        'ដាក់ប្រធានបទនេះ (**ចម្លងប្រធានបទ** ចម្លងវាឱ្យ)៖',
    'Pass the saved file on to whoever maintains the app for you, and {subject}':
        'សូមផ្ញើឯកសារដែលបានរក្សាទុក ទៅអ្នកដែលថែទាំកម្មវិធីឱ្យអ្នក ហើយ {subject}',
    'Pass the saved file and its picture on to whoever maintains the app for you, and {subject}':
        'សូមផ្ញើឯកសារដែលបានរក្សាទុក និងរូបភាពរបស់វា ទៅអ្នកដែលថែទាំកម្មវិធីឱ្យអ្នក ហើយ {subject}',
    'To send it, email the report to {email}{source} — press **Copy report** and paste it into the message, and {subject}':
        'ដើម្បីផ្ញើវា សូមផ្ញើរបាយការណ៍តាមអ៊ីមែលទៅ {email}{source} — ចុច **ចម្លងរបាយការណ៍** ហើយបិទភ្ជាប់វាក្នុងសារ ហើយ {subject}',
    'To send it, email the report to {email}{source} — press **Copy report** and paste it into the message, attach {image} from your Downloads folder, and {subject}':
        'ដើម្បីផ្ញើវា សូមផ្ញើរបាយការណ៍តាមអ៊ីមែលទៅ {email}{source} — ចុច **ចម្លងរបាយការណ៍** ហើយបិទភ្ជាប់វាក្នុងសារ ភ្ជាប់ {image} ពីថត Downloads របស់អ្នក ហើយ {subject}',
    '**Email it** opens your mail app with the address and subject filled in and the report on your clipboard.':
        '**ផ្ញើតាមអ៊ីមែល** បើកកម្មវិធីអ៊ីមែលរបស់អ្នក ដោយបំពេញអាសយដ្ឋាន និងប្រធានបទរួចហើយ ហើយរបាយការណ៍ស្ថិតនៅក្នុងក្ដារតម្បៀតខ្ទាស់របស់អ្នក។',
    'Copy subject': 'ចម្លងប្រធានបទ',
    'Copy picture': 'ចម្លងរូបភាព',
    'Copy email address': 'ចម្លងអាសយដ្ឋានអ៊ីមែល',
    'Email it': 'ផ្ញើតាមអ៊ីមែល',
    'I could not save the report: {reason}':
        'ខ្ញុំមិនអាចរក្សាទុករបាយការណ៍បានទេ៖ {reason}',
    'The report is called {reference}.': 'របាយការណ៍នេះមានឈ្មោះ {reference}។',
    'Sent. Report {reference} went to the report server openworship.app shares and I kept a copy in your Downloads folder too.':
        'បានផ្ញើហើយ។ របាយការណ៍ {reference} បានទៅដល់ម៉ាស៊ីនមេទទួលរបាយការណ៍ដែល openworship.app ចែករំលែក ហើយខ្ញុំក៏បានរក្សាច្បាប់ចម្លងមួយក្នុងថត Downloads របស់អ្នកដែរ។',
    'Sent. Report {reference} went to the report server openworship.app shares, with {count} file — {names} — and I kept a copy in your Downloads folder too.':
        'បានផ្ញើហើយ។ របាយការណ៍ {reference} បានទៅដល់ម៉ាស៊ីនមេទទួលរបាយការណ៍ដែល openworship.app ចែករំលែក ជាមួយឯកសារ {count} — {names} — ហើយខ្ញុំក៏បានរក្សាច្បាប់ចម្លងមួយក្នុងថត Downloads របស់អ្នកដែរ។',
    'Sent. Report {reference} went to the report server openworship.app shares, with {count} files — {names} — and I kept a copy in your Downloads folder too.':
        'បានផ្ញើហើយ។ របាយការណ៍ {reference} បានទៅដល់ម៉ាស៊ីនមេទទួលរបាយការណ៍ដែល openworship.app ចែករំលែក ជាមួយឯកសារ {count} — {names} — ហើយខ្ញុំក៏បានរក្សាច្បាប់ចម្លងមួយក្នុងថត Downloads របស់អ្នកដែរ។',
    'Not sent with it: {files}.': 'មិនបានផ្ញើជាមួយ៖ {files}។',
    'The picture is still in Downloads, and the buttons below email it if somebody asks to see it.':
        'រូបភាពនៅតែមាននៅក្នុង Downloads ហើយប៊ូតុងខាងក្រោមអាចផ្ញើវាតាមអ៊ីមែល បើមាននរណាម្នាក់សុំមើល។',
    'Report {reference} is ready, but the report server is not answering right now ({why}). I kept it, and the app will send it by itself as soon as that server is back — it tries every half hour while the app is open, for up to a week — so there is nothing more you need to do. A copy is in your Downloads folder too, and if it is urgent the buttons below email it.':
        'របាយការណ៍ {reference} រួចរាល់ហើយ ប៉ុន្តែម៉ាស៊ីនមេទទួលរបាយការណ៍មិនឆ្លើយតបនៅពេលនេះទេ ({why})។ ខ្ញុំបានរក្សាវាទុក ហើយកម្មវិធីនឹងផ្ញើវាដោយខ្លួនឯង ភ្លាមៗពេលម៉ាស៊ីនមេនោះត្រឡប់មកវិញ — វាព្យាយាមរៀងរាល់កន្លះម៉ោង ពេលកម្មវិធីកំពុងបើក រហូតដល់មួយសប្ដាហ៍ — ដូច្នេះអ្នកមិនចាំបាច់ធ្វើអ្វីទៀតទេ។ ច្បាប់ចម្លងមួយក៏នៅក្នុងថត Downloads របស់អ្នកដែរ ហើយបើបន្ទាន់ ប៊ូតុងខាងក្រោមអាចផ្ញើវាតាមអ៊ីមែល។',
    'it is away': 'វាមិននៅទេ',
    'Report {reference} is ready. No report server is shared with this app right now, so nothing was sent — I saved the whole thing into your Downloads folder.':
        'របាយការណ៍ {reference} រួចរាល់ហើយ។ មិនទាន់មានម៉ាស៊ីនមេទទួលរបាយការណ៍ ដែលបានចែករំលែកជាមួយកម្មវិធីនេះនៅពេលនេះទេ ដូច្នេះគ្មានអ្វីត្រូវបានផ្ញើទេ — ខ្ញុំបានរក្សាទុកវាទាំងមូលក្នុងថត Downloads របស់អ្នក។',
    'Report {reference} is ready, but I could not send it: {why}. Nothing was sent — I saved the whole thing into your Downloads folder.':
        'របាយការណ៍ {reference} រួចរាល់ហើយ ប៉ុន្តែខ្ញុំមិនអាចផ្ញើវាបានទេ៖ {why}។ គ្មានអ្វីត្រូវបានផ្ញើទេ — ខ្ញុំបានរក្សាទុកវាទាំងមូលក្នុងថត Downloads របស់អ្នក។',
    'larger than a report may carry, {size} MB':
        'ធំជាងអ្វីដែលរបាយការណ៍អាចផ្ទុកបាន ({size} MB)',
    'this window no longer holds the picture': 'បង្អួចនេះលែងមានរូបភាពនោះទៀតហើយ',
    'the file is not where it was on their computer any more':
        'ឯកសារលែងនៅកន្លែងដើមលើកុំព្យូទ័ររបស់អ្នកទៀតហើយ',
    'not a kind of file a report carries':
        'មិនមែនជាប្រភេទឯកសារដែលរបាយការណ៍អាចផ្ទុកបានទេ',
    'the report already carries as much as it may':
        'របាយការណ៍បានផ្ទុកអស់ចំនួនដែលអាចផ្ទុកបានហើយ',
    'it could not be read': 'មិនអាចអានវាបានទេ',
    'the report server found the files too large':
        'ម៉ាស៊ីនមេទទួលរបាយការណ៍យល់ថាឯកសារធំពេក',
    'the app took too long to send it': 'កម្មវិធីចំណាយពេលយូរពេកក្នុងការផ្ញើវា',
    'the app could not hand it over': 'កម្មវិធីមិនអាចបញ្ជូនវាបានទេ',
    'the report server has no usable address':
        'ម៉ាស៊ីនមេទទួលរបាយការណ៍គ្មានអាសយដ្ឋានដែលអាចប្រើបានទេ',
    'the report server did not keep it':
        'ម៉ាស៊ីនមេទទួលរបាយការណ៍មិនបានរក្សាទុកវាទេ',
    'the report server sent it on to another address':
        'ម៉ាស៊ីនមេទទួលរបាយការណ៍បានបញ្ជូនវាបន្តទៅអាសយដ្ឋានផ្សេង',
    'the report server said it is too large':
        'ម៉ាស៊ីនមេទទួលរបាយការណ៍បាននិយាយថាវាធំពេក',
    'the report server took too long to answer':
        'ម៉ាស៊ីនមេទទួលរបាយការណ៍ចំណាយពេលយូរពេកក្នុងការឆ្លើយ',
    'the report server did not answer': 'ម៉ាស៊ីនមេទទួលរបាយការណ៍មិនបានឆ្លើយទេ',
    'AI features are turned off in Settings':
        'មុខងារ AI ត្រូវបានបិទនៅក្នុងការកំណត់',
    'that is not a report this app wrote':
        'នោះមិនមែនជារបាយការណ៍ដែលកម្មវិធីនេះបានសរសេរទេ',
    'several reports were sent in the last few minutes; wait a little before sending another':
        'របាយការណ៍ជាច្រើនត្រូវបានផ្ញើក្នុងរយៈពេលពីរបីនាទីមុននេះ; សូមរង់ចាំបន្តិច មុនផ្ញើមួយទៀត',
    'the list of report servers could not be read':
        'មិនអាចអានបញ្ជីម៉ាស៊ីនមេទទួលរបាយការណ៍បានទេ',
    'I agree': 'ខ្ញុំយល់ព្រម',
    'Open the website': 'បើកគេហទំព័រ',
    'Install it': 'ដំឡើង',
    'Start over': 'ចាប់ផ្ដើមម្ដងទៀត',
    'Find more lists online': 'ស្វែងរកបញ្ជីបន្ថែមលើអ៊ីនធឺណិត',
    'Look for a Bible by language': 'ស្វែងរកព្រះគម្ពីរតាមភាសា',
    'Do it in Settings instead': 'ធ្វើនៅក្នុងការកំណត់វិញ',
    'A file on this computer': 'ឯកសារនៅលើកុំព្យូទ័រនេះ',
    'Import a Bible for me': 'នាំចូលព្រះគម្ពីរឱ្យខ្ញុំ',
    'List {number}': 'បញ្ជី {number}',
    '{choice} (suggested)': '{choice} (ណែនាំ)',
    'A short name is 2 to 24 letters or numbers, like KJV.':
        'ឈ្មោះខ្លីមានអក្សរ ឬលេខពី 2 ដល់ 24 ដូចជា KJV។',
    '"{key}" has a space in it. Use letters and numbers only, like KSV.':
        '"{key}" មានដកឃ្លា។ សូមប្រើតែអក្សរ និងលេខ ដូចជា KSV។',
    '"{key}" has a sign in it that cannot be in a file name. Use letters and numbers only.':
        '"{key}" មានសញ្ញាដែលមិនអាចនៅក្នុងឈ្មោះឯកសារបានទេ។ សូមប្រើតែអក្សរ និងលេខប៉ុណ្ណោះ។',
    'You already have a Bible called "{key}". Choose another name.':
        'អ្នកមានព្រះគម្ពីរឈ្មោះ "{key}" រួចហើយ។ សូមជ្រើសឈ្មោះផ្សេង។',
    '**Step 1 of {total} — a short name.** This is the name on the Bible button, like KJV.':
        '**ជំហាន 1 នៃ {total} — ឈ្មោះខ្លី។** នេះជាឈ្មោះនៅលើប៊ូតុងព្រះគម្ពីរ ដូចជា KJV។',
    'Press one, or type your own (letters and numbers, no spaces).':
        'សូមចុចមួយ ឬវាយឈ្មោះផ្ទាល់ខ្លួន (អក្សរ និងលេខ គ្មានដកឃ្លា)។',
    'Type one (letters and numbers, no spaces).':
        'សូមវាយឈ្មោះមួយ (អក្សរ និងលេខ គ្មានដកឃ្លា)។',
    '**Step 2 of {total} — the language.** I could not tell which language this Bible is in. Type its name, for example Khmer, Thai or French.':
        '**ជំហាន 2 នៃ {total} — ភាសា។** ខ្ញុំមិនអាចដឹងថាព្រះគម្ពីរនេះជាភាសាអ្វីទេ។ សូមវាយឈ្មោះភាសាជាភាសាអង់គ្លេស ឧទាហរណ៍ Khmer, Thai ឬ French។',
    '**Step 2 of {total} — the language.** It looks like **{language}**: {why}. If it is a different language, type its name.':
        '**ជំហាន 2 នៃ {total} — ភាសា។** មើលទៅដូចជា **{language}**៖ {why}។ បើជាភាសាផ្សេង សូមវាយឈ្មោះភាសានោះ។',
    '**Step 2 of {total} — the language.** It looks like **{language}**. If it is a different language, type its name.':
        '**ជំហាន 2 នៃ {total} — ភាសា។** មើលទៅដូចជា **{language}**។ បើជាភាសាផ្សេង សូមវាយឈ្មោះភាសានោះ។',
    '**Step 3 of 4 — numbers.** Should chapter and verse numbers show in {language} digits, or as 0 to 9?':
        '**ជំហាន 3 នៃ 4 — លេខ។** តើលេខជំពូក និងលេខខគម្ពីរ គួរបង្ហាញជាលេខ {language} ឬជាលេខ 0 ដល់ 9?',
    'its own': 'របស់វាផ្ទាល់',
    'Only this list says: {names}.': 'មានតែបញ្ជីនេះដែលសរសេរ៖ {names}។',
    '({count} of its names are in this Bible)':
        '(ឈ្មោះ {count} របស់វាមាននៅក្នុងព្រះគម្ពីរនេះ)',
    '**Step {total} of {total} — book names.** These are the names shown for Genesis, Exodus and the rest. Pick the list that matches your printed Bible — list 1 matches the words of this Bible best.':
        '**ជំហាន {total} នៃ {total} — ឈ្មោះគម្ពីរ។** ទាំងនេះជាឈ្មោះដែលបង្ហាញសម្រាប់ លោកុប្បត្តិ និក្ខមនំ និងគម្ពីរផ្សេងទៀត។ សូមជ្រើសបញ្ជីដែលដូចនឹងព្រះគម្ពីរបោះពុម្ពរបស់អ្នក — បញ្ជី 1 ត្រូវនឹងពាក្យនៃព្រះគម្ពីរនេះជាងគេ។',
    '**Step {total} of {total} — book names.** These are the names shown for Genesis, Exodus and the rest. Pick the list that matches your printed Bible.':
        '**ជំហាន {total} នៃ {total} — ឈ្មោះគម្ពីរ។** ទាំងនេះជាឈ្មោះដែលបង្ហាញសម្រាប់ លោកុប្បត្តិ និក្ខមនំ និងគម្ពីរផ្សេងទៀត។ សូមជ្រើសបញ្ជីដែលដូចនឹងព្រះគម្ពីរបោះពុម្ពរបស់អ្នក។',
    '**Ready to install.**': '**រួចរាល់សម្រាប់ដំឡើង។**',
    '- Name: **{key}**': '- ឈ្មោះ៖ **{key}**',
    '- Language: {language}': '- ភាសា៖ {language}',
    '- Numbers: {digits}': '- លេខ៖ {digits}',
    '- Book names: {names}': '- ឈ្មោះគម្ពីរ៖ {names}',
    'from the file': 'ពីឯកសារ',
    'Press **Install it**. You can undo it afterwards.':
        'សូមចុច **ដំឡើង**។ អ្នកអាចត្រឡប់វាវិញបាននៅពេលក្រោយ។',
    'That link does not lead to a file — the website answered "not found". The address may be mistyped, or the file has moved.':
        'តំណនោះមិននាំទៅឯកសារទេ — គេហទំព័របានឆ្លើយថា "រកមិនឃើញ"។ អាសយដ្ឋានប្រហែលជាវាយខុស ឬឯកសារត្រូវបានផ្លាស់ទីហើយ។',
    'That website would not give the file out. It may need a sign-in.':
        'គេហទំព័រនោះមិនព្រមផ្ដល់ឯកសារទេ។ វាប្រហែលជាត្រូវការចូលគណនី។',
    'That website is busy right now. Try again in a few minutes.':
        'គេហទំព័រនោះកំពុងរវល់ពេលនេះ។ សូមព្យាយាមម្ដងទៀតក្នុងរយៈពេលពីរបីនាទី។',
    'That website had a problem sending the file. Try again later.':
        'គេហទំព័រនោះមានបញ្ហាក្នុងការផ្ញើឯកសារ។ សូមព្យាយាមម្ដងទៀតនៅពេលក្រោយ។',
    'I can only download from a public web address that starts with https://.':
        'ខ្ញុំអាចទាញយកបានតែពីអាសយដ្ឋានវេបសាធារណៈ ដែលចាប់ផ្ដើមដោយ https:// ប៉ុណ្ណោះ។',
    'I could not reach that website. Check the internet connection and the address.':
        'ខ្ញុំមិនអាចចូលទៅគេហទំព័រនោះបានទេ។ សូមពិនិត្យការភ្ជាប់អ៊ីនធឺណិត និងអាសយដ្ឋាន។',
    'The download took too long and I stopped it. The website or the internet may be slow — try again.':
        'ការទាញយកចំណាយពេលយូរពេក ខ្ញុំក៏បានបញ្ឈប់វា។ គេហទំព័រ ឬអ៊ីនធឺណិតប្រហែលជាយឺត — សូមព្យាយាមម្ដងទៀត។',
    'That file is far too large to be a Bible.':
        'ឯកសារនោះធំពេកណាស់ មិនអាចជាព្រះគម្ពីរបានទេ។',
    'That link gave back an empty file.': 'តំណនោះបានផ្ដល់ឯកសារទទេមកវិញ។',
    'That link leads to a file, but not a Bible file this app can install. A Bible file ends in .xml.':
        'តំណនោះនាំទៅឯកសារមួយ ប៉ុន្តែមិនមែនជាឯកសារព្រះគម្ពីរដែលកម្មវិធីនេះអាចដំឡើងបានទេ។ ឯកសារព្រះគម្ពីរបញ្ចប់ដោយ .xml។',
    'I downloaded the file, but there is no Bible in it that this app can read — it may be a different Bible format.':
        'ខ្ញុំបានទាញយកឯកសារហើយ ប៉ុន្តែគ្មានព្រះគម្ពីរដែលកម្មវិធីនេះអាចអានបាននៅក្នុងនោះទេ — វាប្រហែលជាទម្រង់ព្រះគម្ពីរផ្សេង។',
    'That link opens a web page, and there is no Bible file on it.':
        'តំណនោះបើកទំព័រវេបមួយ ហើយគ្មានឯកសារព្រះគម្ពីរនៅលើវាទេ។',
    'That download is not here any more — downloads are kept for two hours.':
        'ការទាញយកនោះលែងមាននៅទីនេះទៀតហើយ — ការទាញយកត្រូវបានរក្សាទុកតែពីរម៉ោងប៉ុណ្ណោះ។',
    'That link did not lead to a Bible.': 'តំណនោះមិននាំទៅព្រះគម្ពីរទេ។',
    'To get the right link: open the page in your web browser, find the Bible file (its name ends in .xml), and copy the address of THAT file — on GitHub, open the file and press **Raw**, then copy the address bar. Paste it here.':
        'ដើម្បីបានតំណត្រឹមត្រូវ៖ សូមបើកទំព័រនោះក្នុងកម្មវិធីរុករកវេបរបស់អ្នក រកឯកសារព្រះគម្ពីរ (ឈ្មោះរបស់វាបញ្ចប់ដោយ .xml) ហើយចម្លងអាសយដ្ឋានរបស់ឯកសារនោះ — នៅលើ GitHub បើកឯកសារនោះ ហើយចុច **Raw** រួចចម្លងរបារអាសយដ្ឋាន។ បិទភ្ជាប់វានៅទីនេះ។',
    '**{matched}** has “{words}” in the name':
        '**{matched}** មាន “{words}” នៅក្នុងឈ្មោះ',
    '**{matched}** have “{words}” in the name':
        '**{matched}** មាន “{words}” នៅក្នុងឈ្មោះ',
    'Of its **{total}** Bibles, {matchedText}.':
        'ក្នុងចំណោមព្រះគម្ពីរ **{total}** របស់វា {matchedText}។',
    'It has **{total}** Bibles.': 'វាមានព្រះគម្ពីរ **{total}**។',
    'It has **{total}** Bible files; {matchedText}.':
        'វាមានឯកសារព្រះគម្ពីរ **{total}**; {matchedText}។',
    'It has **{total}** Bible files.': 'វាមានឯកសារព្រះគម្ពីរ **{total}**។',
    'I looked in the free Bible collection on GitHub (Beblia).':
        'ខ្ញុំបានរកមើលក្នុងបណ្ដុំព្រះគម្ពីរឥតគិតថ្លៃនៅលើ GitHub (Beblia)។',
    'That link is a web page, not the Bible file itself.':
        'តំណនោះជាទំព័រវេប មិនមែនជាឯកសារព្រះគម្ពីរខ្លួនឯងទេ។',
    'None of them has “{words}” in its name.':
        'គ្មានមួយណាមាន “{words}” នៅក្នុងឈ្មោះទេ។',
    'Did you mean one of these? Press it, or type the language again.':
        'តើអ្នកចង់និយាយពីមួយក្នុងចំណោមទាំងនេះឬ? សូមចុចវា ឬវាយឈ្មោះភាសាម្ដងទៀត។',
    'Type the language in English or in its own words — for example Khmer, ខ្មែរ or Thai. If you have a link to a Bible file, you can paste it here instead.':
        'សូមវាយឈ្មោះភាសាជាភាសាអង់គ្លេស ឬជាភាសានោះផ្ទាល់ — ឧទាហរណ៍ Khmer, ខ្មែរ ឬ Thai។ បើអ្នកមានតំណទៅឯកសារព្រះគម្ពីរ អ្នកអាចបិទភ្ជាប់វានៅទីនេះជំនួសវិញ។',
    '**you already have this one** ({key})': '**អ្នកមានមួយនេះរួចហើយ** ({key})',
    'Press the one you want, or type a word from its name — a year, for example — to see others.':
        'សូមចុចមួយដែលអ្នកចង់បាន ឬវាយពាក្យមួយពីឈ្មោះរបស់វា — ឧទាហរណ៍ ឆ្នាំ — ដើម្បីមើលផ្សេងទៀត។',
    'Press the one you want, or type its number. Nothing is installed until you have chosen its name and language.':
        'សូមចុចមួយដែលអ្នកចង់បាន ឬវាយលេខរបស់វា។ គ្មានអ្វីត្រូវបានដំឡើងទេ រហូតដល់អ្នកជ្រើសឈ្មោះ និងភាសារបស់វា។',
    'I downloaded **{title}** — {summary}.':
        'ខ្ញុំបានទាញយក **{title}** — {summary}។',
    '**You already have this Bible** — it is installed as **{key}**. There is no need to install it again: press **Cancel**.':
        '**អ្នកមានព្រះគម្ពីរនេះរួចហើយ** — វាបានដំឡើងជា **{key}**។ មិនចាំបាច់ដំឡើងម្ដងទៀតទេ៖ សូមចុច **បដិសេធ**។',
    'Nothing is installed yet.': 'មិនទាន់មានអ្វីត្រូវបានដំឡើងនៅឡើយទេ។',
    'It has the New Testament only.': 'វាមានតែគម្ពីរសញ្ញាថ្មីប៉ុណ្ណោះ។',
    'It has the Old Testament only.': 'វាមានតែគម្ពីរសញ្ញាចាស់ប៉ុណ្ណោះ។',
    'It is missing {count} of the 66 books.':
        'វាខ្វះ {count} ក្នុងចំណោមគម្ពីរទាំង 66។',
    '{books} books, {chapters} chapters, {verses} verses':
        '{books} គម្ពីរ {chapters} ជំពូក {verses} ខ',
    'the internet, at the address below.': 'អ៊ីនធឺណិត តាមអាសយដ្ឋានខាងក្រោម។',
    'I found it on the internet, in a free collection of Bible files that someone shared on GitHub (Beblia): {page}':
        'ខ្ញុំបានរកឃើញវានៅលើអ៊ីនធឺណិត ក្នុងបណ្ដុំឯកសារព្រះគម្ពីរឥតគិតថ្លៃ ដែលមាននរណាម្នាក់បានចែករំលែកនៅលើ GitHub (Beblia)៖ {page}',
    'I found it on the internet, on this web page: {page}':
        'ខ្ញុំបានរកឃើញវានៅលើអ៊ីនធឺណិត នៅលើទំព័រវេបនេះ៖ {page}',
    '**Before you install it, please read this:**':
        '**មុនពេលដំឡើង សូមអានសេចក្ដីនេះ៖**',
    '**Where it is from:** {where}': '**មកពីណា៖** {where}',
    '**The file:** {file}': '**ឯកសារ៖** {file}',
    '**It is not from Open Worship.** Open Worship did not make, choose or check this Bible, and cannot promise that it is complete, correct or free to use.':
        '**វាមិនមែនមកពី Open Worship ទេ។** Open Worship មិនបានបង្កើត ជ្រើសរើស ឬពិនិត្យព្រះគម្ពីរនេះទេ ហើយមិនអាចធានាថាវាពេញលេញ ត្រឹមត្រូវ ឬអាចប្រើដោយសេរីបានទេ។',
    '**You are responsible to its publisher.** Every Bible translation belongs to the publisher or Bible society that made it, and many are under copyright. Before you use it — on a screen in church, in print or online — make sure its publisher allows that.':
        '**អ្នកទទួលខុសត្រូវចំពោះអ្នកបោះពុម្ពរបស់វា។** ការបកប្រែព្រះគម្ពីរនីមួយៗ ជាកម្មសិទ្ធិរបស់អ្នកបោះពុម្ព ឬសមាគមព្រះគម្ពីរដែលបានធ្វើវា ហើយជាច្រើនមានរក្សាសិទ្ធិ។ មុនពេលអ្នកប្រើវា — លើអេក្រង់នៅព្រះវិហារ ក្នុងការបោះពុម្ព ឬលើអ៊ីនធឺណិត — សូមប្រាកដថាអ្នកបោះពុម្ពរបស់វាអនុញ្ញាត។',
    'Do you agree? Press **I agree** to go on, or **Cancel** and nothing is installed.':
        'តើអ្នកយល់ព្រមទេ? សូមចុច **ខ្ញុំយល់ព្រម** ដើម្បីបន្ត ឬចុច **បដិសេធ** ហើយគ្មានអ្វីត្រូវបានដំឡើងទេ។',
    'You already have this Bible as **{key}**. To keep a second copy anyway, choose a different short name below.':
        'អ្នកមានព្រះគម្ពីរនេះរួចហើយជា **{key}**។ បើចង់រក្សាច្បាប់ទីពីរ សូមជ្រើសឈ្មោះខ្លីផ្សេងខាងក្រោម។',
    'Thank you. A few quick choices, then I install it.':
        'សូមអរគុណ។ ជម្រើសរហ័សមួយចំនួន រួចខ្ញុំនឹងដំឡើងវា។',
    'The app is looking for a Bible called **{key}**. Keep that short name below and the app will find this Bible by itself.':
        'កម្មវិធីកំពុងរកព្រះគម្ពីរដែលមានឈ្មោះ **{key}**។ សូមរក្សាឈ្មោះខ្លីនោះខាងក្រោម ហើយកម្មវិធីនឹងរកឃើញព្រះគម្ពីរនេះដោយខ្លួនឯង។',
    'There is no web page to open for this Bible.':
        'គ្មានទំព័រវេបសម្រាប់បើកសម្រាប់ព្រះគម្ពីរនេះទេ។',
    'I opened {page} in your web browser. When you have looked, come back here.':
        'ខ្ញុំបានបើក {page} នៅក្នុងកម្មវិធីរុករកវេបរបស់អ្នក។ ពេលអ្នកមើលរួច សូមត្រឡប់មកទីនេះវិញ។',
    'I do not know the language “{language}”. Try its English name or its code, like km-KH.':
        'ខ្ញុំមិនស្គាល់ភាសា “{language}” ទេ។ សូមសាកល្បងឈ្មោះជាភាសាអង់គ្លេស ឬកូដរបស់វា ដូចជា km-KH។',
    'I read “{from}” as **{to}**.': 'ខ្ញុំបានអាន “{from}” ថាជា **{to}**។',
    'I looked online and found no other complete list.':
        'ខ្ញុំបានរកមើលលើអ៊ីនធឺណិត ហើយរកមិនឃើញបញ្ជីពេញលេញផ្សេងទៀតទេ។',
    'The book names on this page do not match your selected language. Try another link or tell me which language to use.':
        'ឈ្មោះគម្ពីរនៅលើទំព័រនេះមិនត្រូវនឹងភាសាដែលអ្នកបានជ្រើសរើសទេ។ សូមសាកល្បងតំណផ្សេង ឬប្រាប់ខ្ញុំថាត្រូវប្រើភាសាអ្វី។',
    'I could not read a complete book-name list from that link. Your previous choices are still available.':
        'ខ្ញុំមិនអាចអានបញ្ជីឈ្មោះគម្ពីរពេញលេញពីតំណនោះបានទេ។ ជម្រើសមុនរបស់អ្នកនៅតែមាន។',
    'I found {count} more online.':
        'ខ្ញុំបានរកឃើញ {count} បន្ថែមទៀតលើអ៊ីនធឺណិត។',
    'I could not use the name **{key}**: you already have a Bible by that name. Choose another.':
        'ខ្ញុំមិនអាចប្រើឈ្មោះ **{key}** បានទេ៖ អ្នកមានព្រះគម្ពីរដែលមានឈ្មោះនោះរួចហើយ។ សូមជ្រើសឈ្មោះផ្សេង។',
    'Something went wrong while installing it. Nothing was changed.':
        'មានបញ្ហាពេលកំពុងដំឡើងវា។ គ្មានអ្វីត្រូវបានផ្លាស់ប្ដូរទេ។',
    '**Done — {key} is installed.** Choose it from the Bible version button in the Bible Lookup or the Reader.':
        '**រួចរាល់ — {key} បានដំឡើងហើយ។** សូមជ្រើសវាពីប៊ូតុងកំណែព្រះគម្ពីរ នៅក្នុង ស្វែងរកព្រះគម្ពីរ ឬ អានព្រះគម្ពីរ។',
    'If it is not right, press **Undo** and it goes to the trash.':
        'បើវាមិនត្រឹមត្រូវ សូមចុច **ត្រឡប់ក្រោយ** ហើយវានឹងទៅធុងសំរាម។',
    'Undone: **{key}** is gone again (it is in the trash). Nothing else was changed.':
        'បានត្រឡប់វិញ៖ **{key}** ត្រូវបានដកចេញវិញហើយ (វានៅក្នុងធុងសំរាម)។ គ្មានអ្វីផ្សេងទៀតត្រូវបានផ្លាស់ប្ដូរទេ។',
    'That was already undone.': 'វាត្រូវបានត្រឡប់វិញរួចហើយ។',
    'Stopped. Nothing was installed.': 'បានបញ្ឈប់។ គ្មានអ្វីត្រូវបានដំឡើងទេ។',
    'Create the provided KJV': 'បង្កើត KJV ដែលផ្តល់ជូន',
    // The Reader's "Bible key KJV is not available!" card asks before it
    // builds the KJV out of the copy the app carries.
    'Create the KJV Bible?': 'បង្កើតព្រះគម្ពីរ KJV មែនទេ?',
    'The KJV Bible is not available. Open Worship provides it, and creating it needs no internet and no separate download: the app already holds the whole KJV.':
        'ព្រះគម្ពីរ KJV មិនមានទេ។ Open Worship ផ្តល់វាជូន ហើយការបង្កើតវាមិនត្រូវការអ៊ីនធឺណិត ឬការទាញយកដោយឡែកទេ៖ កម្មវិធីមាន KJV ទាំងមូលរួចហើយ។',
    'Failed to create the KJV Bible. Please try again.':
        'បរាជ័យក្នុងការបង្កើតព្រះគម្ពីរ KJV។ សូមព្យាយាមម្តងទៀត។',
    'Use the internet copy anyway': 'ប្រើឯកសារពីអ៊ីនធឺណិតនេះវិញ',
    'Import another Bible anyway': 'នាំចូលព្រះគម្ពីរផ្សេងទៀតវិញ',
    'Add another Bible': 'បន្ថែមព្រះគម្ពីរមួយទៀត',
    'Creating the provided KJV Bible': 'កំពុងបង្កើតព្រះគម្ពីរ KJV ដែលផ្តល់ជូន',
    'I could not create the KJV Open Worship provides. Nothing was installed. In **Settings → Bible**, press **{button}**, or try again here.':
        'ខ្ញុំមិនអាចបង្កើត KJV ដែល Open Worship ផ្តល់ជូនបានទេ។ គ្មានអ្វីត្រូវបានដំឡើងទេ។ នៅ **ការកំណត់ → ព្រះគម្ពីរ** សូមចុច **{button}** ឬព្យាយាមម្តងទៀតនៅទីនេះ។',
    '**You already have the KJV Open Worship provides**, installed as **KJV**. There is no need to import this file. To use the file anyway, press a choice below.':
        '**អ្នកមាន KJV ដែល Open Worship ផ្តល់ជូនរួចហើយ** ដំឡើងជា **KJV**។ មិនចាំបាច់នាំចូលឯកសារនេះទេ។ ប្រសិនបើចង់ប្រើឯកសារនេះវិញ សូមចុចជម្រើសខាងក្រោម។',
    '**You already have the KJV Open Worship provides**, installed as **KJV**. There is no need to import this file. To keep a second copy anyway, choose a short name below.':
        '**អ្នកមាន KJV ដែល Open Worship ផ្តល់ជូនរួចហើយ** ដំឡើងជា **KJV**។ មិនចាំបាច់នាំចូលឯកសារនេះទេ។ ប្រសិនបើចង់រក្សាច្បាប់ចម្លងទីពីរ សូមជ្រើសរើសឈ្មោះខ្លីខាងក្រោម។',
    '**Open Worship provides the KJV Bible** — the recommended King James Version, and it is not installed yet. Create it from the app itself and you will have the one this app recommends. To use this file instead, press a choice below.':
        '**Open Worship ផ្តល់ព្រះគម្ពីរ KJV** — គឺជាកំណែ King James ដែលបានណែនាំ ហើយមិនទាន់បានដំឡើងនៅឡើយទេ។ បង្កើតវាពីក្នុងកម្មវិធីផ្ទាល់ ហើយអ្នកនឹងបានកំណែដែលកម្មវិធីនេះណែនាំ។ ប្រសិនបើចង់ប្រើឯកសារនេះជំនួសវិញ សូមចុចជម្រើសខាងក្រោម។',
    '**Before another Bible: Open Worship provides the KJV Bible** — the recommended King James Version, and it is not installed yet. Create it first, and then I will start your import again. To go on without it, press a choice below.':
        '**មុនព្រះគម្ពីរផ្សេងទៀត៖ Open Worship ផ្តល់ព្រះគម្ពីរ KJV** — គឺជាកំណែ King James ដែលបានណែនាំ ហើយមិនទាន់បានដំឡើងនៅឡើយទេ។ សូមបង្កើតវាជាមុនសិន រួចខ្ញុំនឹងចាប់ផ្តើមការនាំចូលរបស់អ្នកឡើងវិញ។ ប្រសិនបើចង់បន្តដោយគ្មានវា សូមចុចជម្រើសខាងក្រោម។',
    'Creating it needs no internet and no separate download: the app already holds the whole KJV.':
        'ការបង្កើតវាមិនត្រូវការអ៊ីនធឺណិត ឬការទាញយកដោយឡែកទេ៖ កម្មវិធីមាន KJV ទាំងមូលរួចហើយ។',
    '**Done — the KJV Open Worship provides is installed.** Choose **KJV** from the Bible version button. A Bible Reader card saying the KJV is not available goes away by itself.':
        '**រួចរាល់ — KJV ដែល Open Worship ផ្តល់ជូនត្រូវបានដំឡើងហើយ។** សូមជ្រើសរើស **KJV** ពីប៊ូតុងកំណែព្រះគម្ពីរ។ កាតក្នុងកម្មវិធីអានព្រះគម្ពីរដែលថា KJV មិនអាចប្រើបាន នឹងបាត់ទៅវិញដោយខ្លួនឯង។',
    'I opened **Settings → Bible** with your link in the Import box. Press **Import** there, then choose the name, language, numbers and book names on the form.':
        'ខ្ញុំបានបើក **ការកំណត់ → ព្រះគម្ពីរ** ដោយដាក់តំណរបស់អ្នកក្នុងប្រអប់ នាំចូល រួចហើយ។ សូមចុច **នាំចូល** នៅទីនោះ បន្ទាប់មកជ្រើសឈ្មោះ ភាសា លេខ និងឈ្មោះគម្ពីរ នៅលើទម្រង់បែបបទ។',
    'That step is not one I know.': 'ខ្ញុំមិនស្គាល់ជំហាននោះទេ។',
    'Something went wrong on my side. The app may still be starting — try again in a moment. Nothing was installed.':
        'មានបញ្ហាខាងខ្ញុំ។ កម្មវិធីប្រហែលជាកំពុងចាប់ផ្ដើមនៅឡើយ — សូមព្យាយាមម្ដងទៀតបន្តិចទៀត។ គ្មានអ្វីត្រូវបានដំឡើងទេ។',
    '**Which language do you want the Bible in?** Press one, or type its name — in English or in its own words, for example Thai, ខ្មែរ or Español. I will look in a free collection of about a thousand Bibles and show you every one in that language. If you have a link to a Bible file, you can paste it here instead.':
        '**តើអ្នកចង់បានព្រះគម្ពីរជាភាសាអ្វី?** សូមចុចមួយ ឬវាយឈ្មោះភាសា — ជាភាសាអង់គ្លេស ឬជាភាសានោះផ្ទាល់ ឧទាហរណ៍ Thai, ខ្មែរ ឬ Español។ ខ្ញុំនឹងរកមើលក្នុងបណ្ដុំព្រះគម្ពីរឥតគិតថ្លៃប្រហែលមួយពាន់ ហើយបង្ហាញអ្នកនូវព្រះគម្ពីរទាំងអស់ជាភាសានោះ។ បើអ្នកមានតំណទៅឯកសារព្រះគម្ពីរ អ្នកអាចបិទភ្ជាប់វានៅទីនេះជំនួសវិញ។',
    'I opened **Settings → Bible**. Press **Choose File**, pick the Bible file (its name ends in .xml), then press **Import** below it.':
        'ខ្ញុំបានបើក **ការកំណត់ → ព្រះគម្ពីរ**។ សូមចុច **ជ្រើសរើសឯកសារ** ជ្រើសឯកសារព្រះគម្ពីរ (ឈ្មោះរបស់វាបញ្ចប់ដោយ .xml) បន្ទាប់មកចុច **នាំចូល** នៅខាងក្រោមវា។',
    'Looking online for Bible book names — this can take a minute':
        'កំពុងរកឈ្មោះគម្ពីរនៅលើអ៊ីនធឺណិត — វាអាចចំណាយពេលមួយនាទី',
    'Putting it back': 'កំពុងដាក់វាត្រឡប់វិញ',
    'this server needs tool calling switched on — start llama-server (or llamafile) again with the --jinja flag, then ask again':
        'ម៉ាស៊ីនមេនេះត្រូវបើកការហៅឧបករណ៍ — សូមចាប់ផ្ដើម llama-server (ឬ llamafile) ម្តងទៀតជាមួយ --jinja រួចសួរម្តងទៀត',
    'this server needs tool calling switched on — start it again with --enable-auto-tool-choice and --tool-call-parser (vLLM, SGLang), then ask again':
        'ម៉ាស៊ីនមេនេះត្រូវបើកការហៅឧបករណ៍ — សូមចាប់ផ្ដើមវាម្តងទៀតជាមួយ --enable-auto-tool-choice និង --tool-call-parser (vLLM, SGLang) រួចសួរម្តងទៀត',
    'this model cannot use tools, which the assistant needs to look things up — pick a model that supports tools':
        'ម៉ូដែលនេះមិនអាចប្រើឧបករណ៍បានទេ ដែលជំនួយការត្រូវការដើម្បីស្វែងរក — សូមជ្រើសម៉ូដែលដែលគាំទ្រឧបករណ៍',
    'this server’s API does not take tools at all (GPT4All’s does not), so the assistant can only answer from the guide text — for presses and live answers use LM Studio, Ollama or llama.cpp':
        'API របស់ម៉ាស៊ីនមេនេះមិនទទួលឧបករណ៍ទាល់តែសោះ (GPT4All មិនទទួលទេ) ដូច្នេះជំនួយការអាចឆ្លើយបានតែពីអត្ថបទមគ្គុទ្ទេសក៍ — ដើម្បីចុចប៊ូតុង និងឆ្លើយពីកម្មវិធីផ្ទាល់ សូមប្រើ LM Studio, Ollama ឬ llama.cpp',
    "the conversation does not fit this model's context — {fix}, then ask again":
        'ការសន្ទនាធំពេកសម្រាប់ទំហំបរិបទរបស់ម៉ូដែលនេះ — {fix} រួចសួរម្តងទៀត',
    'the conversation does not fit the {size} context this model is loaded with — {fix}, then ask again':
        'ការសន្ទនាធំពេកសម្រាប់បរិបទ {size} ដែលម៉ូដែលនេះត្រូវបានផ្ទុក — {fix} រួចសួរម្តងទៀត',
    'it loaded this model with only {size} of context and answered from part of the question, so that answer is not shown — {fix}, then ask again':
        'វាបានផ្ទុកម៉ូដែលនេះជាមួយបរិបទត្រឹមតែ {size} ហើយបានឆ្លើយពីផ្នែកខ្លះនៃសំណួរប៉ុណ្ណោះ ដូច្នេះចម្លើយនោះមិនត្រូវបានបង្ហាញទេ — {fix} រួចសួរម្តងទៀត',
    'load it again in LM Studio with a Context Length of {size} or more (the model’s load settings)':
        'សូមផ្ទុកវាម្តងទៀតក្នុង LM Studio ជាមួយ Context Length ចាប់ពី {size} ឡើងទៅ (ក្នុងការកំណត់ផ្ទុករបស់ម៉ូដែល)',
    'in the Ollama app, set Settings → Context length to {size} or more (or start Ollama with OLLAMA_CONTEXT_LENGTH={tokens})':
        'ក្នុងកម្មវិធី Ollama សូមកំណត់ Settings → Context length ចាប់ពី {size} ឡើងទៅ (ឬចាប់ផ្ដើម Ollama ជាមួយ OLLAMA_CONTEXT_LENGTH={tokens})',
    'start llama-server (or llamafile) again with a context size of {size} or more (-c {tokens})':
        'សូមចាប់ផ្ដើម llama-server (ឬ llamafile) ម្តងទៀតជាមួយទំហំបរិបទចាប់ពី {size} ឡើងទៅ (-c {tokens})',
    'load it with a context length of {size} or more where the model is served':
        'សូមផ្ទុកវាជាមួយទំហំបរិបទចាប់ពី {size} ឡើងទៅ នៅកន្លែងដែលដំណើរការម៉ូដែល',
    'this server has no model called “{model}” — check the model id in Settings → AI Providers → Custom servers, press Load models from server there, or pull it (ollama pull {model})':
        'ម៉ាស៊ីនមេនេះគ្មានម៉ូដែលឈ្មោះ “{model}” ទេ — សូមពិនិត្យលេខសម្គាល់ម៉ូដែលក្នុង ការកំណត់ → អ្នកផ្តល់សេវា AI → Custom servers ហើយចុច Load models from server នៅទីនោះ ឬទាញយកវា (ollama pull {model})',
    'this server has no model called “{model}” — check the model id in Settings → AI Providers → Custom servers, press Load models from server there':
        'ម៉ាស៊ីនមេនេះគ្មានម៉ូដែលឈ្មោះ “{model}” ទេ — សូមពិនិត្យលេខសម្គាល់ម៉ូដែលក្នុង ការកំណត់ → អ្នកផ្តល់សេវា AI → Custom servers ហើយចុច Load models from server នៅទីនោះ',
    'this shared server did not answer the way the app expects — its address is openworship.app’s to correct; press ↻ beside the list of assistants to read the shared servers again, or pick another assistant':
        'ម៉ាស៊ីនមេរួមនេះមិនបានឆ្លើយតាមរបៀបដែលកម្មវិធីរំពឹងទុកទេ — អាសយដ្ឋានរបស់វាត្រូវកែដោយ openworship.app; សូមចុច ↻ ក្បែរបញ្ជីជំនួយការ ដើម្បីអានម៉ាស៊ីនមេរួមម្តងទៀត ឬជ្រើសជំនួយការផ្សេង',
    'this server did not answer the way the app expects — in Settings → AI Providers → Custom servers, check its address and press Test':
        'ម៉ាស៊ីនមេនេះមិនបានឆ្លើយតាមរបៀបដែលកម្មវិធីរំពឹងទុកទេ — ក្នុង ការកំណត់ → អ្នកផ្តល់សេវា AI → Custom servers សូមពិនិត្យអាសយដ្ឋានរបស់វា ហើយចុច Test',
    'the server took longer than {minutes} minutes over the question and the window gave up — a local model reads the assistant’s whole instruction set first, and this computer is too slow for that; a general question typed after /btw is small enough to answer here, and questions about the app need a faster computer or a model running on a GPU':
        'ម៉ាស៊ីនមេប្រើពេលលើសពី {minutes} នាទីលើសំណួរនេះ ហើយបង្អួចបានបោះបង់ — ម៉ូដែលនៅលើម៉ាស៊ីនត្រូវអានការណែនាំទាំងអស់របស់ជំនួយការជាមុន ហើយកុំព្យូទ័រនេះយឺតពេកសម្រាប់ការងារនោះ; សំណួរទូទៅដែលវាយបន្ទាប់ពី /btw តូចល្មមអាចឆ្លើយនៅទីនេះបាន ចំណែកសំណួរអំពីកម្មវិធីត្រូវការកុំព្យូទ័រលឿនជាងនេះ ឬម៉ូដែលដែលដំណើរការលើ GPU',
    'the server took longer than {minutes} minutes over the question and the window gave up — a local model reads the assistant’s whole instruction set first, and the computer it runs on is too slow for that; a general question typed after /btw is small enough to answer here, and questions about the app need a faster computer or a model running on a GPU':
        'ម៉ាស៊ីនមេប្រើពេលលើសពី {minutes} នាទីលើសំណួរនេះ ហើយបង្អួចបានបោះបង់ — ម៉ូដែលនៅលើម៉ាស៊ីនត្រូវអានការណែនាំទាំងអស់របស់ជំនួយការជាមុន ហើយកុំព្យូទ័រដែលវាដំណើរការលើនោះយឺតពេកសម្រាប់ការងារនោះ; សំណួរទូទៅដែលវាយបន្ទាប់ពី /btw តូចល្មមអាចឆ្លើយនៅទីនេះបាន ចំណែកសំណួរអំពីកម្មវិធីត្រូវការកុំព្យូទ័រលឿនជាងនេះ ឬម៉ូដែលដែលដំណើរការលើ GPU',
    '(Ollama marks them “tools” in its library)':
        '(Ollama សម្គាល់ពួកវាថា “tools” ក្នុងបណ្ណាល័យរបស់វា)',
    'Nothing to press for this one — it is something to notice in the window behind me. Press {next} when you have.':
        'ជំហាននេះគ្មានអ្វីត្រូវចុចទេ — គ្រាន់តែមើលក្នុងបង្អួចនៅពីក្រោយខ្ញុំ។ មើលរួចហើយ សូមចុច {next}។',
    '{key} does something that cannot be undone, so I will not press it for you. Press it yourself if you want it — I will notice when you do.':
        '{key} ធ្វើអ្វីមួយដែលមិនអាចត្រឡប់វិញបាន ដូច្នេះខ្ញុំនឹងមិនចុចវាជំនួសអ្នកទេ។ បើអ្នកចង់ សូមចុចវាដោយខ្លួនឯង — ខ្ញុំនឹងដឹងពេលអ្នកចុច។',
    'Press {act} and I will press {key} for you.':
        'ចុច {act} ហើយខ្ញុំនឹងចុច {key} ជំនួសអ្នក។',
    'Press {key} — I will notice when you do.':
        'ចុច {key} — ខ្ញុំនឹងដឹងពេលអ្នកចុច។',
    'Press {act} and I will right-click the list for you, then press it again to choose "{name}".':
        'ចុច {act} ហើយខ្ញុំនឹងចុចកណ្ដុរស្ដាំលើបញ្ជីជំនួសអ្នក បន្ទាប់មកចុចវាម្តងទៀតដើម្បីជ្រើស "{name}"។',
    'Press {act} and I will right-click the list for you, then press it again to choose.':
        'ចុច {act} ហើយខ្ញុំនឹងចុចកណ្ដុរស្ដាំលើបញ្ជីជំនួសអ្នក បន្ទាប់មកចុចវាម្តងទៀតដើម្បីជ្រើសរើស។',
    'Look for "{name}" in the window behind me.':
        'សូមរក "{name}" នៅក្នុងបង្អួចនៅពីក្រោយខ្ញុំ។',
    'Do this step in the window behind me.':
        'សូមធ្វើជំហាននេះនៅក្នុងបង្អួចនៅពីក្រោយខ្ញុំ។',
    'Look for "{name}" in the window behind me. The closest thing I can see is "{seen}", which may not be it.':
        'សូមរក "{name}" នៅក្នុងបង្អួចនៅពីក្រោយខ្ញុំ។ អ្វីដែលជិតបំផុតដែលខ្ញុំឃើញគឺ "{seen}" ប៉ុន្តែប្រហែលមិនមែនទេ។',
    'Press {act} and I will open the hidden controls first. Then press it again and I will change "{name}".':
        'ចុច {act} ហើយខ្ញុំនឹងបើកប៊ូតុងដែលលាក់ជាមុនសិន។ បន្ទាប់មកចុចម្តងទៀត ហើយខ្ញុំនឹងប្តូរ "{name}"។',
    'Press {act} and I will open the hidden controls first. Then press it again and I will use "{name}".':
        'ចុច {act} ហើយខ្ញុំនឹងបើកប៊ូតុងដែលលាក់ជាមុនសិន។ បន្ទាប់មកចុចម្តងទៀត ហើយខ្ញុំនឹងប្រើ "{name}"។',
    'First press the ringed three dots to open the hidden controls. I will keep this step here for you.':
        'ដំបូង សូមចុចចំណុចបីដែលមានរង្វង់ក្រហម ដើម្បីបើកប៊ូតុងដែលលាក់។ ខ្ញុំនឹងទុកជំហាននេះនៅទីនេះសម្រាប់អ្នក។',
    '"{name}" is not on screen right now — open the panel or tab it belongs to first.':
        '"{name}" មិននៅលើអេក្រង់ឥឡូវនេះទេ — សូមបើកផ្ទាំង ឬថេបរបស់វាជាមុនសិន។',
    '"{name}" is behind {layer} — answer that first, and I will carry on.':
        '"{name}" នៅពីក្រោយ {layer} — សូមឆ្លើយវាជាមុនសិន ហើយខ្ញុំនឹងបន្ត។',
    '"{name}" is behind {layer}.': '"{name}" នៅពីក្រោយ {layer}។',
    'Press {act} and I will close the menu first, then press it again for this step.':
        'ចុច {act} ហើយខ្ញុំនឹងបិទម៉ឺនុយជាមុនសិន បន្ទាប់មកចុចម្តងទៀតសម្រាប់ជំហាននេះ។',
    'Press Escape (or click anywhere outside the menu) and I will carry on.':
        'ចុច Escape (ឬចុចកន្លែងណាមួយនៅក្រៅម៉ឺនុយ) ហើយខ្ញុំនឹងបន្ត។',
    'Press {act} and I will close {short} first, then press it again for this step.':
        'ចុច {act} ហើយខ្ញុំនឹងបិទ {short} ជាមុនសិន បន្ទាប់មកចុចម្តងទៀតសម្រាប់ជំហាននេះ។',
    'Close it with the ringed ✕ and I will carry on.':
        'សូមបិទវាដោយចុច ✕ ដែលមានរង្វង់ក្រហម ហើយខ្ញុំនឹងបន្ត។',
    'Press {act} and I will change it for you.':
        'ចុច {act} ហើយខ្ញុំនឹងប្តូរវាជំនួសអ្នក។',
    'Press {act} and I will right-click it for you.':
        'ចុច {act} ហើយខ្ញុំនឹងចុចកណ្ដុរស្ដាំលើវាជំនួសអ្នក។',
    'Press {act} and I will move the pointer over it for you.':
        'ចុច {act} ហើយខ្ញុំនឹងដាក់ព្រួញកណ្ដុរលើវាជំនួសអ្នក។',
    'Press {act} and I will click it for you.':
        'ចុច {act} ហើយខ្ញុំនឹងចុចវាជំនួសអ្នក។',
    'This is the app asking you a question, so I will not answer it for you.':
        'នេះជាកម្មវិធីកំពុងសួរអ្នក ដូច្នេះខ្ញុំនឹងមិនឆ្លើយជំនួសអ្នកទេ។',
    'This one cannot be undone, so I will not press it for you — press it yourself if you want it.':
        'ប៊ូតុងនេះមិនអាចត្រឡប់វិញបានទេ ដូច្នេះខ្ញុំនឹងមិនចុចជំនួសអ្នកទេ — បើអ្នកចង់ សូមចុចដោយខ្លួនឯង។',
    'Move the pointer over the ringed area.':
        'សូមដាក់ព្រួញកណ្ដុរលើកន្លែងដែលមានរង្វង់ក្រហម។',
    'This one only shows while the mouse is over it, so I am holding it up for you.':
        'ប៊ូតុងនេះបង្ហាញតែពេលកណ្ដុរនៅលើវាប៉ុណ្ណោះ ដូច្នេះខ្ញុំកំពុងបង្ហាញវាឲ្យអ្នក។',
    'The ringed control is at the {where} of this window.':
        'ប៊ូតុងដែលមានរង្វង់ក្រហម នៅ{where} នៃបង្អួចនេះ។',
    'The ringed control is in the {panel} panel, at the {where} of this window.':
        'ប៊ូតុងដែលមានរង្វង់ក្រហម នៅក្នុងផ្ទាំង {panel} នៅ{where} នៃបង្អួចនេះ។',
    'Something is in front of it right now — close that first.':
        'ឥឡូវនេះមានអ្វីមួយនៅពីមុខវា — សូមបិទវាជាមុនសិន។',
    '{count} controls are called "{name}" (in {panels}), so the ring may be on the wrong one — the step says which.':
        'មានប៊ូតុង {count} ដែលមានឈ្មោះ "{name}" (នៅក្នុង {panels}) ដូច្នេះរង្វង់អាចនៅលើប៊ូតុងខុស — ជំហានប្រាប់ថាមួយណា។',
    '{count} controls are called "{name}", so the ring may be on the wrong one — the step says which.':
        'មានប៊ូតុង {count} ដែលមានឈ្មោះ "{name}" ដូច្នេះរង្វង់អាចនៅលើប៊ូតុងខុស — ជំហានប្រាប់ថាមួយណា។',
    'I cannot press these steps for you — they are things to do in the page itself, not buttons. I will walk you through them instead.':
        'ខ្ញុំមិនអាចចុចជំហានទាំងនេះជំនួសអ្នកបានទេ — វាជាកិច្ចការត្រូវធ្វើក្នុងទំព័រផ្ទាល់ មិនមែនប៊ូតុងទេ។ ខ្ញុំនឹងណែនាំអ្នកម្តងមួយជំហានវិញ។',
    'I opened the hidden controls. "{more}" is visible now. Press {act} again and I will finish this step.':
        'ខ្ញុំបានបើកប៊ូតុងដែលលាក់រួចហើយ។ ឥឡូវនេះ "{more}" អាចមើលឃើញ។ ចុច {act} ម្តងទៀត ហើយខ្ញុំនឹងបញ្ចប់ជំហាននេះ។',
    'Done - and it brought up "{more}". Press {act} again to finish this step.':
        'រួចហើយ - ហើយវាបានបង្ហាញ "{more}"។ ចុច {act} ម្តងទៀតដើម្បីបញ្ចប់ជំហាននេះ។',
    'I closed {closed}, which was in the way. Press {act} again and I will do this step.':
        'ខ្ញុំបានបិទ {closed} ដែលបាំងនៅពីមុខ។ ចុច {act} ម្តងទៀត ហើយខ្ញុំនឹងធ្វើជំហាននេះ។',
    'That did not work — I am asking the assistant to look at your window…':
        'វាមិនដំណើរការទេ — ខ្ញុំកំពុងសុំឲ្យជំនួយការមើលបង្អួចរបស់អ្នក…',
    'I could not do that one for you ({reason}) - do it yourself, then press {skip}.':
        'ខ្ញុំមិនអាចធ្វើជំហាននោះជំនួសអ្នកបានទេ ({reason}) - សូមធ្វើវាដោយខ្លួនឯង រួចចុច {skip}។',
    // The help window's own words (src/chatbot/, `chatTranHelpers.ts`).
    'Choose an AI chat': 'ជ្រើសរើសផ្ទាំងជជែក AI',
    'Choose an AI chat to use in this window':
        'ជ្រើសរើសផ្ទាំងជជែក AI ដើម្បីប្រើក្នុងផ្ទាំងនេះ',
    'Switch anytime from the list above the page. You sign in on the site itself, with your own account, and your conversations stay there.':
        'អ្នកអាចប្តូរបានគ្រប់ពេលពីបញ្ជីនៅខាងលើទំព័រ។ អ្នកចូលគណនីនៅលើគេហទំព័រនោះផ្ទាល់ ដោយប្រើគណនីរបស់អ្នកផ្ទាល់ ហើយការសន្ទនារបស់អ្នកនៅតែនៅទីនោះ។',
    'Recently closed': 'ទើបបិទថ្មីៗ',
    'These are other companies’ websites. What you type there leaves this computer under their terms; this app keeps nothing of it but the tab.':
        'ទាំងនេះជាគេហទំព័ររបស់ក្រុមហ៊ុនផ្សេង។ អ្វីដែលអ្នកវាយនៅទីនោះ ចាកចេញពីកុំព្យូទ័រនេះតាមលក្ខខណ្ឌរបស់ពួកគេ។ កម្មវិធីនេះមិនរក្សាទុកអ្វីទាំងអស់ក្រៅពីផ្ទាំងនោះទេ។',
    'You stay signed in on this computer until you say otherwise. {button} when several people use it.':
        'អ្នកនៅតែចូលគណនីនៅលើកុំព្យូទ័រនេះ រហូតដល់អ្នកសម្រេចផ្សេង។ ចុច {button} នៅពេលមានមនុស្សច្រើននាក់ប្រើវា។',
    'Sign out of every site': 'ចាកចេញពីគណនីគ្រប់គេហទំព័រ',
    'Loading {site}': 'កំពុងផ្ទុក {site}',
    '{site} could not be loaded — {reason}. Check the internet connection.':
        'មិនអាចផ្ទុក {site} បានទេ — {reason}។ សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិត។',
    'Chat with': 'ជជែកជាមួយ',
    'Which AI chat': 'ផ្ទាំងជជែក AI មួយណា',
    'Open in your browser': 'បើកក្នុងកម្មវិធីរុករករបស់អ្នក',
    'Recently closed tabs (Ctrl+Shift+T opens the last)':
        'ផ្ទាំងដែលទើបបិទថ្មីៗ (Ctrl+Shift+T បើកផ្ទាំងចុងក្រោយ)',
    'Recently closed tabs': 'ផ្ទាំងដែលទើបបិទថ្មីៗ',
    'Signing out did not finish, so nothing was changed. Try again.':
        'ការចាកចេញពីគណនីមិនបានបញ្ចប់ទេ ដូច្នេះគ្មានអ្វីត្រូវបានផ្លាស់ប្តូរទេ។ សូមព្យាយាមម្តងទៀត។',
    'Sign out of every site, in every AI Chat window? The tabs stay, but the pages they were on and the recently closed list are forgotten, and every site will ask you to sign in again. This cannot be undone.':
        'ចាកចេញពីគណនីគ្រប់គេហទំព័រ ក្នុងគ្រប់ផ្ទាំងជជែក AI ឬ? ផ្ទាំងទាំងនោះនៅដដែល ប៉ុន្តែទំព័រដែលវាបានបើក និងបញ្ជីផ្ទាំងដែលទើបបិទ នឹងត្រូវបំភ្លេចចោល ហើយគ្រប់គេហទំព័រនឹងសុំឱ្យអ្នកចូលគណនីម្តងទៀត។ សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។',
    'Keep me signed in': 'រក្សាការចូលគណនីរបស់ខ្ញុំ',
    'Signing out…': 'កំពុងចាកចេញពីគណនី…',
    Microphone: 'មីក្រូហ្វូន',
    '{site} wants to use your microphone. Allow it until the app closes? Only this site hears it, and the camera stays off. Sign out of every site takes it back.':
        '{site} ចង់ប្រើមីក្រូហ្វូនរបស់អ្នក។ អនុញ្ញាតរហូតដល់បិទកម្មវិធីឬ? មានតែគេហទំព័រនេះទេដែលឮ ហើយកាមេរ៉ានៅតែបិទ។ «ចាកចេញពីគណនីគ្រប់គេហទំព័រ» នឹងដកការអនុញ្ញាតនេះវិញ។',
    'Don’t allow': 'មិនអនុញ្ញាត',
    Allow: 'អនុញ្ញាត',
    Chat: 'ការជជែក',
    'just now': 'អម្បាញ់មិញ',
    '{count} min ago': '{count} នាទីមុន',
    '{count} h ago': '{count} ម៉ោងមុន',
    yesterday: 'ម្សិលមិញ',
    '{count} days ago': '{count} ថ្ងៃមុន',
    'Tabs you close show up here, so you can open them again.':
        'ផ្ទាំងដែលអ្នកបិទ នឹងបង្ហាញនៅទីនេះ ដើម្បីឱ្យអ្នកអាចបើកវាម្តងទៀតបាន។',
    'Open “{title}” again': 'បើក «{title}» ម្តងទៀត',
    'Close a tab before opening another':
        'សូមបិទផ្ទាំងមួយសិន មុននឹងបើកផ្ទាំងផ្សេងទៀត',
    'Clear this list': 'សម្អាតបញ្ជីនេះ',
    'Page not opened': 'ទំព័រមិនត្រូវបានបើកទេ',
    'This site tried to open {site} in your browser without a press, so it was not opened. Press the link again if you meant it.':
        'គេហទំព័រនេះបានព្យាយាមបើក {site} ក្នុងកម្មវិធីរុករករបស់អ្នក ដោយគ្មានការចុច ដូច្នេះវាមិនត្រូវបានបើកទេ។ សូមចុចតំណនោះម្តងទៀត ប្រសិនបើអ្នកចង់បើកវាពិតមែន។',
    'I will search **{bible}**.': 'ខ្ញុំនឹងស្វែងរកក្នុង **{bible}**។',
    '**What do you remember about the verse?** Type it in the box below, the way it comes to you:':
        '**តើអ្នកចាំអ្វីខ្លះអំពីខគម្ពីរនោះ?** សូមវាយវានៅក្នុងប្រអប់ខាងក្រោម តាមដែលអ្នកនឹកឃើញ៖',
    'a few of its words, in any order — _love, enemies, pray_':
        'ពាក្យខ្លះរបស់វា តាមលំដាប់ណាក៏បាន — _ស្រឡាញ់ ខ្មាំងសត្រូវ អធិស្ឋាន_',
    'or what it is about — _a verse about not worrying about tomorrow_':
        'ឬអំពីអ្វីដែលវានិយាយ — _ខគម្ពីរអំពីការមិនខ្វល់ខ្វាយពីថ្ងៃស្អែក_',
    'If you remember the book, or roughly where it is, say that too.':
        'ប្រសិនបើអ្នកចាំគម្ពីរ ឬចាំប្រហែលថាវានៅកន្លែងណា សូមប្រាប់ផងដែរ។',
    'There is no Bible on this computer to search yet. Install one first — I can do that with you, one question at a time.':
        'មិនទាន់មានព្រះគម្ពីរនៅលើកុំព្យូទ័រនេះសម្រាប់ស្វែងរកនៅឡើយទេ។ សូមដំឡើងមួយជាមុនសិន — ខ្ញុំអាចជួយធ្វើជាមួយអ្នក ម្តងមួយសំណួរ។',
    'I could not read the Bibles in the app just now. Make sure the main window is open, then press the 🤖 in **{find}** again.':
        'ខ្ញុំមិនអាចអានព្រះគម្ពីរក្នុងកម្មវិធីបានទេឥឡូវនេះ។ សូមប្រាកដថាផ្ទាំងមេកំពុងបើក រួចចុច 🤖 ក្នុង **{find}** ម្តងទៀត។',
    'There is one Bible on this computer, so that is the one.':
        'មានព្រះគម្ពីរតែមួយនៅលើកុំព្យូទ័រនេះ ដូច្នេះខ្ញុំនឹងប្រើព្រះគម្ពីរនោះ។',
    '**Which Bible should I search?** Pick one below.':
        '**តើខ្ញុំគួរស្វែងរកក្នុងព្រះគម្ពីរមួយណា?** សូមជ្រើសរើសមួយខាងក្រោម។',
    'Or type the short name of another one: {names}.':
        'ឬវាយឈ្មោះខ្លីនៃព្រះគម្ពីរផ្សេងទៀត៖ {names}។',
    '(searched in {other}, quoted from {bible})':
        '(ស្វែងរកក្នុង {other} ដកស្រង់ពី {bible})',
    'In {bible}, for your words': 'ក្នុង {bible} សម្រាប់ពាក្យរបស់អ្នក',
    'In {bible}, for your words in English: “{english}”':
        'ក្នុង {bible} សម្រាប់ពាក្យរបស់អ្នកជាភាសាអង់គ្លេស៖ «{english}»',
    'If none of these is the one, say more of what you remember.':
        'ប្រសិនបើគ្មានខណាមួយត្រឹមត្រូវទេ សូមប្រាប់បន្ថែមពីអ្វីដែលអ្នកចាំ។',
    'If it is still not here, search Google for it:':
        'ប្រសិនបើនៅតែរកមិនឃើញ សូមស្វែងរកវាលើ Google៖',
    'Those words are not written in the language of {bible}, so there is nothing in it to match them. Type them the way that Bible writes them, or press **{another}** below to search one in your language for them.':
        'ពាក្យទាំងនោះមិនមែនសរសេរជាភាសារបស់ {bible} ទេ ដូច្នេះគ្មានអ្វីក្នុងនោះត្រូវគ្នាទេ។ សូមវាយវាតាមរបៀបដែលព្រះគម្ពីរនោះសរសេរ ឬចុច **{another}** ខាងក្រោម ដើម្បីស្វែងរកពាក្យទាំងនោះក្នុងព្រះគម្ពីរជាភាសារបស់អ្នក។',
    'Show in another Bible': 'បង្ហាញក្នុងព្រះគម្ពីរផ្សេងទៀត',
    'These words gather in {passages}.':
        'ពាក្យទាំងនេះមានច្រើននៅក្នុង {passages}។',
    'By book: {books}.': 'តាមគម្ពីរនីមួយៗ៖ {books}។',
    'Every verse with these words': 'ខគម្ពីរទាំងអស់ដែលមានពាក្យទាំងនេះ',
    'More verses': 'ខគម្ពីរបន្ថែមទៀត',
    'No more verses in {bible} have those words.':
        'គ្មានខគម្ពីរផ្សេងទៀតក្នុង {bible} ដែលមានពាក្យទាំងនោះទេ។',
    'That is as far as a search goes. Add a word you remember to narrow it down.':
        'ការស្វែងរកបង្ហាញបានត្រឹមនេះ។ សូមបន្ថែមពាក្យដែលអ្នកចាំ ដើម្បីឲ្យរកបានចំជាងនេះ។',
    'That is every verse in {bible} with those words.':
        'នេះជាខគម្ពីរទាំងអស់ក្នុង {bible} ដែលមានពាក្យទាំងនោះ។',
    'Verses {first} to {last} of {total} in {bible} that have your words:':
        'ខទី {first} ដល់ {last} ក្នុងចំណោម {total} ខក្នុង {bible} ដែលមានពាក្យរបស់អ្នក៖',
    '{bible} is the only Bible on this computer. To read or search in another language, install a Bible in it first — I can do that with you, one question at a time.':
        '{bible} ជាព្រះគម្ពីរតែមួយគត់នៅលើកុំព្យូទ័រនេះ។ ដើម្បីអាន ឬស្វែងរកជាភាសាផ្សេង សូមដំឡើងព្រះគម្ពីរជាភាសានោះជាមុនសិន — ខ្ញុំអាចជួយធ្វើជាមួយអ្នក ម្តងមួយសំណួរ។',
    'I could not read those verses in {bible}.':
        'ខ្ញុំមិនអាចអានខគម្ពីរទាំងនោះក្នុង {bible} បានទេ។',
    'From **{bible}**:': 'ពី **{bible}**៖',
    '{bible} does not have {refs}.': '{bible} មិនមាន {refs} ទេ។',
    'If it is not here, say more of what you remember, and I will search {bible}.':
        'ប្រសិនបើមិនមែនខនេះទេ សូមប្រាប់បន្ថែមពីអ្វីដែលអ្នកចាំ ហើយខ្ញុំនឹងស្វែងរកក្នុង {bible}។',
    '**Which Bible should I show the verse in?** Pick one below.':
        '**តើខ្ញុំគួរបង្ហាញខគម្ពីរនេះក្នុងព្រះគម្ពីរមួយណា?** សូមជ្រើសរើសមួយខាងក្រោម។',
    '**Which Bible should I show the verses in?** Pick one below.':
        '**តើខ្ញុំគួរបង្ហាញខគម្ពីរទាំងនេះក្នុងព្រះគម្ពីរមួយណា?** សូមជ្រើសរើសមួយខាងក្រោម។',
    'An assistant can also take words in your language and find the verse: pick one in the row above, or add a key in Settings → AI Providers.':
        'ជំនួយការក៏អាចយកពាក្យជាភាសារបស់អ្នក ហើយស្វែងរកខគម្ពីរបានដែរ៖ សូមជ្រើសរើសមួយនៅជួរខាងលើ ឬបន្ថែមកូនសោក្នុង ការកំណត់ → អ្នកផ្តល់សេវា AI។',
    'I could not search the Bible just now. Make sure the main window is open, then type the words again.':
        'ខ្ញុំមិនអាចស្វែងរកក្នុងព្រះគម្ពីរបានទេឥឡូវនេះ។ សូមប្រាកដថាផ្ទាំងមេកំពុងបើក រួចវាយពាក្យនោះម្តងទៀត។',
    'If you remember what it is ABOUT rather than its words, an assistant can search by meaning: pick one in the row above, or add a key in Settings → AI Providers.':
        'ប្រសិនបើអ្នកចាំថាវានិយាយអំពីអ្វី ជាជាងពាក្យរបស់វា ជំនួយការអាចស្វែងរកតាមអត្ថន័យបាន៖ សូមជ្រើសរើសមួយនៅជួរខាងលើ ឬបន្ថែមកូនសោក្នុង ការកំណត់ → អ្នកផ្តល់សេវា AI។',
    'No verse in {bible} has those words together.':
        'គ្មានខគម្ពីរណាក្នុង {bible} មានពាក្យទាំងនោះជាមួយគ្នាទេ។',
    'These are not in it at all: {words}.':
        'ពាក្យទាំងនេះមិនមានក្នុងនោះសោះ៖ {words}។',
    'Try fewer words, or other forms of them (forgive / forgave).':
        'សូមសាកល្បងពាក្យតិចជាងនេះ ឬទម្រង់ផ្សេងនៃពាក្យទាំងនោះ (អត់ទោស / បានអត់ទោស)។',
    '{hits} of {of} words': '{hits} ក្នុងចំណោម {of} ពាក្យ',
    'These verses in {bible} have the most of your words:':
        'ខគម្ពីរទាំងនេះក្នុង {bible} មានពាក្យរបស់អ្នកច្រើនជាងគេ៖',
    '{total} verses have some of them; add a word you remember to narrow it down.':
        'មានខគម្ពីរ {total} ដែលមានពាក្យខ្លះ។ សូមបន្ថែមពាក្យដែលអ្នកចាំ ដើម្បីបង្រួមលទ្ធផល។',
    'I could not open that verse just now.':
        'ខ្ញុំមិនអាចបើកខគម្ពីរនោះបានទេឥឡូវនេះ។',
    '**Look at the app window.** {verse} is open in the Bible Lookup. Nothing went on a screen.':
        '**សូមមើលផ្ទាំងកម្មវិធី។** {verse} បានបើកក្នុងការស្វែងរកព្រះគម្ពីរ។ គ្មានអ្វីត្រូវបានបង្ហាញលើអេក្រង់ទេ។',
    'Help me find a Bible verse': 'ជួយខ្ញុំស្វែងរកខគម្ពីរមួយ',
    'Help me find a Bible verse in "{bible}"':
        'ជួយខ្ញុំស្វែងរកខគម្ពីរមួយក្នុង «{bible}»',
    'Import the Bible called "{name}"': 'នាំចូលព្រះគម្ពីរដែលមានឈ្មោះ «{name}»',
    'Import a Bible from {link}': 'នាំចូលព្រះគម្ពីរពី {link}',
    'Import a Bible': 'នាំចូលព្រះគម្ពីរ',
    // The help window's own words (src/chatbot/, `chatTranHelpers.ts`).
    'Click the control you mean {name} · Esc to cancel':
        'ចុចលើប៊ូតុងដែលអ្នកចង់និយាយអំពី {name} · ចុច Esc ដើម្បីបោះបង់',
    // The help window's own words (src/chatbot/, `chatTranHelpers.ts`).
    'Putting your question into English with {model}':
        'កំពុងបកប្រែសំណួររបស់អ្នកជាភាសាអង់គ្លេសដោយប្រើ {model}',
    'Putting the answer into your language with {model}':
        'កំពុងបកប្រែចម្លើយជាភាសារបស់អ្នកដោយប្រើ {model}',
    'I could not put this answer into {language}, so it is in English.':
        'ខ្ញុំមិនអាចបកប្រែចម្លើយនេះជា{language}បានទេ ដូច្នេះវានៅជាភាសាអង់គ្លេស។',
    'The tips are back, on the line above the box.':
        'គន្លឹះបានត្រឡប់មកវិញហើយ នៅលើបន្ទាត់ខាងលើប្រអប់។',
    'The tips are on the line above the box.': 'គន្លឹះនៅលើបន្ទាត់ខាងលើប្រអប់។',
    'Press a tip for another one, or the arrows beside it to go through them all. Here is one:':
        'ចុចលើគន្លឹះ ដើម្បីមើលគន្លឹះផ្សេងទៀត ឬចុចព្រួញនៅក្បែរវា ដើម្បីមើលគន្លឹះទាំងអស់ម្តងមួយៗ។ នេះជាគន្លឹះមួយ៖',
    'Show the tips above the box again, and one of them now':
        'បង្ហាញគន្លឹះនៅខាងលើប្រអប់ម្តងទៀត និងគន្លឹះមួយឥឡូវនេះ',
    // The help window's own words (src/chatbot/, `chatTranHelpers.ts`).
    Reader: 'អានព្រះគម្ពីរ',
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

// The names a slide, a song or a PowerPoint asks for, answered by the
// Battambang this app ships. A font installed on the presenting computer
// never reaches a phone or TV watching a virtual display, nor a Screen Mirror
// guest: each drew its own system Khmer face instead, with other metrics, and
// a fixed text box could wrap differently. `Battambang` IS the shipped font,
// so it is answered by the file at once. `Khmer OS Battambang` and
// `Kh Battambang` are other designs: one installed here wins (`local()`), and
// only a device without it falls back to the shipped one. A face is fetched
// only when text uses it.
function genKhmerFontAliasCss() {
    const btbFaces: [string, string][] = [
        [btbRegular, 'normal'],
        [btbBold, 'bold'],
        [btbLight, '300'],
        [btbThin, '100'],
        [btbBlack, '900'],
    ];
    const sameFont = btbFaces.map(([file, weight]) => {
        return `
        @font-face {
            font-family: "${globalFontFamily}";
            src: url(${file}) format("truetype");
            font-weight: ${weight};
        }`;
    });
    const lookAlikes = ['Khmer OS Battambang', 'Kh Battambang'].map(
        (family) => {
            return `
        @font-face {
            font-family: "${family}";
            src: local("${family}"), url(${btbRegular}) format("truetype");
            font-weight: normal;
        }`;
        },
    );
    return [...sameFont, ...lookAlikes].join('\n');
}
const lang: LanguageDataType = {
    packageDir: '',
    version: '0.0.1',
    locale: 'km-KH',
    langCode: 'km',
    editorLink: 'https://editor-km.openworship.app',
    bibleBooks,
    getBibleKeyNameMap: () => {
        return bibleKeyMap;
    },
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
        ${genKhmerFontAliasCss()}
        `;
    },
    fontFamily,
    globalFontFamily,
    stickyNoteFontFamily,
    numList,
    dictionary: sanitizedDictionary,
    name: 'Khmer',
    nativeName: 'ខ្មែរ',
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
    bookMarkerWords: ['ក្នុង', 'គម្ពីរ', 'សៀវភៅ', 'កណ្ឌ'],
    findFrameWords: [
        'ស្វែងរក',
        'សូម',
        'ជួយ',
        'ខ្ញុំ',
        'តើ',
        'ខគម្ពីរ',
        'បទគម្ពីរ',
        'ព្រះគម្ពីរ',
        'គម្ពីរ',
        'រឿង',
        'អំពី',
        'និយាយ',
        'នៅក្នុង',
        'ក្នុង',
    ],
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
    getBibleCrossRefBundleFilePath(resolveGzBundleFilePath) {
        return resolveGzBundleFilePath(bbCR);
    },
    async getLookupDataVersion({ readJsonFileVersion }) {
        const [namesMap, locationsMap] = await Promise.all([
            readJsonFileVersion(namesMapUrl),
            readJsonFileVersion(locationsMapUrl),
        ]);
        if (namesMap === null || locationsMap === null) {
            return null;
        }
        return { namesMap, locationsMap };
    },
    async getLookupData({ readJsonFile }) {
        try {
            const namesMap = await readJsonFile(namesMapUrl);
            const locationsMap = await readJsonFile(locationsMapUrl);
            return { namesMap, locationsMap };
        } catch (error) {
            console.error(error);
            return null;
        }
    },
    initOpenLyricPlugins: ({
        editor,
        openLyric,
        openLyricMarkdownManager,
        genOpenLyricFontFaces,
    }) => {
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
