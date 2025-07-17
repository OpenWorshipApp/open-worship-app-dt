import BibleLookupPopupComp from '../bible-lookup/BibleLookupPopupComp';
import { useIsBibleLookupShowingContext } from '../others/commonButtons';

export default function AppPopupWindowsComp() {
    const { isShowing: isBibleLookupShowing } =
        useIsBibleLookupShowingContext();
    if (isBibleLookupShowing) {
        return <BibleLookupPopupComp />;
    }
    return null;
}
