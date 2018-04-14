// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import { DynamicCommandLineParser } from '../DynamicCommandLineParser';
import { DynamicCommandLineAction } from '../DynamicCommandLineAction';

describe('DynamicCommandLineParser tests', () => {

  it('simple case', () => {
    const commandLineParser: DynamicCommandLineParser = new DynamicCommandLineParser(
      {
        toolFilename: 'example',
        toolDescription: 'An example project'
      }
    );

    const action: DynamicCommandLineAction = new DynamicCommandLineAction({
      actionVerb: 'do-job',
      summary: 'does the job',
      documentation: 'a longer description'
    });
    commandLineParser.addAction(action);
    action.defineFlagParameter({
      parameterLongName: '--flag',
      description: 'The flag'
    });

    return commandLineParser.execute(['do-job', '--flag']).then(() => {
      expect(commandLineParser.selectedAction).toEqual(action);
    });
  });
});
