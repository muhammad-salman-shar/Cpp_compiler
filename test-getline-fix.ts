// Test file to verify the getline() bug fix
// This test simulates the exact scenario described in the bug report

import { lex } from './compiler/lexer';
import { parse } from './compiler/parser';
import { runProgram, InputPromptSignal } from './compiler/interpreter';

const testCode = `
#include <iostream>
#include <string>
using namespace std;

int main() {
    int age;
    string name;
    
    cout << "Enter age: ";
    cin >> age;
    
    cin.ignore();
    
    cout << "Enter full name: ";
    getline(cin, name);
    
    cout << "Name: " << name << endl;
    cout << "Age: " << age << endl;
    
    if (age >= 18) {
        cout << "Status: Adult" << endl;
    } else {
        cout << "Status: Minor" << endl;
    }
    
    return 0;
}
`;

console.log('=== Testing getline() Bug Fix ===\n');

// Simulate the interactive input flow
let accumulatedInputs: string[] = [];
let executionCount = 0;

function runWithInput(inputs: string[]) {
    executionCount++;
    console.log(`\n--- Execution #${executionCount} ---`);
    console.log(`Input buffer: ${JSON.stringify(inputs.join('\n') + '\n')}`);
    
    const stdinText = inputs.join('\n') + '\n';
    const output: string[] = [];
    
    try {
        const tokens = lex(testCode).tokens;
        const ast = parse(tokens, testCode);
        const result = runProgram(ast, stdinText, (line) => {
            output.push(line);
            console.log(`[OUTPUT] ${line}`);
        });
        
        console.log(`✓ Program completed successfully`);
        console.log(`Exit code: ${result.exitCode}`);
        return { success: true, output };
    } catch (e) {
        if (e instanceof InputPromptSignal) {
            console.log(`⚠ InputPromptSignal caught - need more input`);
            console.log(`Output so far: ${output.join('')}`);
            return { success: false, output, needsInput: true };
        } else {
            console.error(`✗ Error:`, e);
            return { success: false, output, error: e };
        }
    }
}

// Test scenario: User enters age first, then name
console.log('Step 1: User enters age = 18');
accumulatedInputs = ['18'];
let result = runWithInput(accumulatedInputs);

if (!result.success && result.needsInput) {
    console.log('\nStep 2: User enters name = Muhammad Salman Shar');
    accumulatedInputs.push('Muhammad Salman Shar');
    result = runWithInput(accumulatedInputs);
}

if (result.success) {
    console.log('\n=== Final Output ===');
    console.log(result.output.join('\n'));
    
    // Verify the output contains the expected values
    const outputText = result.output.join('\n');
    const hasName = outputText.includes('Name: Muhammad Salman Shar');
    const hasAge = outputText.includes('Age: 18');
    const hasStatus = outputText.includes('Status: Adult');
    
    console.log('\n=== Verification ===');
    console.log(`✓ Name displayed correctly: ${hasName}`);
    console.log(`✓ Age displayed correctly: ${hasAge}`);
    console.log(`✓ Status displayed correctly: ${hasStatus}`);
    
    if (hasName && hasAge && hasStatus) {
        console.log('\n✅ TEST PASSED: getline() bug is fixed!');
    } else {
        console.log('\n❌ TEST FAILED: Output does not match expected values');
    }
} else {
    console.log('\n❌ TEST FAILED: Program did not complete successfully');
}
