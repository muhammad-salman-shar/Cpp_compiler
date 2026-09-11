/**
 * File System Access API utilities for opening and saving files
 * Falls back gracefully if the API is not available
 */

export interface FileHandle {
  name: string;
  contents: string;
}

/**
 * Check if File System Access API is available
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

/**
 * Open a file using the File System Access API
 * Returns null if cancelled or API not available
 */
export async function openFileWithPicker(): Promise<FileHandle | null> {
  if (!isFileSystemAccessSupported()) {
    return null;
  }

  try {
    // @ts-ignore - File System Access API types
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'C++ Source Files',
          accept: {
            'text/x-c': ['.cpp', '.c', '.h', '.hpp', '.cc', '.cxx'],
          },
        },
      ],
      multiple: false,
    });

    const file = await handle.getFile();
    const contents = await file.text();

    return {
      name: handle.name,
      contents,
    };
  } catch (err) {
    // User cancelled or error occurred
    console.log('File open cancelled or failed:', err);
    return null;
  }
}

/**
 * Save content to a file using the File System Access API
 * Returns true if successful, false if cancelled or API not available
 */
export async function saveFileWithPicker(
  content: string,
  suggestedName: string = 'untitled.cpp'
): Promise<boolean> {
  if (!isFileSystemAccessSupported()) {
    return false;
  }

  try {
    // @ts-ignore - File System Access API types
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: 'C++ Source Files',
          accept: {
            'text/x-c': ['.cpp', '.c', '.h', '.hpp', '.cc', '.cxx'],
          },
        },
      ],
    });

    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();

    return true;
  } catch (err) {
    // User cancelled or error occurred
    console.log('File save cancelled or failed:', err);
    return false;
  }
}

/**
 * Handle files opened via "Open With" from file manager
 * Uses the File Handling API (launchQueue)
 */
export function setupFileHandler(
  onFileOpen: (name: string, contents: string) => void
): void {
  // @ts-ignore - File Handling API types
  if ('launchQueue' in window && 'setConsumer' in window.launchQueue) {
    // @ts-ignore
    window.launchQueue.setConsumer((launchParams: any) => {
      if (launchParams.files && launchParams.files.length > 0) {
        launchParams.files.forEach(async (file: any) => {
          try {
            const contents = await file.text();
            onFileOpen(file.name, contents);
          } catch (err) {
            console.error('Failed to read file:', err);
          }
        });
      }
    });
  }
}
