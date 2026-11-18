import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** Height of the on-screen keyboard (0 when hidden). A position:absolute view is not moved by KeyboardAvoidingView's padding,
 *  so the floating footer reads this instead. iOS reports the Will events (in step with the animation), Android only the Did events. */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
}
