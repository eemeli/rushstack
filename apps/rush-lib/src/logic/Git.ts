// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import gitInfo = require('git-repo-info');
import * as child_process from 'child_process';
import * as os from 'os';

import { Utilities } from '../utilities/Utilities';
import { AlreadyReportedError } from '../utilities/AlreadyReportedError';
import { GitEmailPolicy } from './policy/GitEmailPolicy';
import { RushConfiguration } from '../api/RushConfiguration';

interface IResultOrError<TResult> {
  error?: Error;
  result?: TResult;
}

export class Git {
  private static _hasGit: boolean | undefined = undefined;
  private static _gitPath: string | undefined;

  public static getGitPath(): string | undefined {
    if (Git._hasGit === undefined) {
      const command: string = process.platform === 'win32' ? 'where' : 'which';
      const result: child_process.SpawnSyncReturns<string> = child_process.spawnSync(command, ['git']);

      if (result.status === 0) {
        Git._gitPath = result.stdout;
        Git._hasGit = !!result.stdout;
      }
    }

    return Git._gitPath;
  }

  public static detectIfGitIsSupported(): boolean {
    if (Git.getGitPath()) { // Do we even have a git binary?
      try {
        return !!gitInfo().sha;
      } catch (e) {
        return false; // Unexpected, but possible if the .git directory is corrupted.
      }
    } else {
      return false;
    }
  }

  public static getGitEmail(rushConfiguration: RushConfiguration): string {
    // Determine the user's account
    // Ex: "bob@example.com"
    const emailResult: IResultOrError<string> = Git.tryGetGitEmail();
    if (emailResult.error) {
      console.log(
        [
          `Error: ${emailResult.error.message}`,
          'Unable to determine your Git configuration using this command:',
          '',
          '    git config user.email',
          ''
        ].join(os.EOL)
      );
      throw new AlreadyReportedError();
    }

    if (!emailResult.result) {
      console.log([
        'This operation requires that a git email be specified.',
        '',
        `If you didn't configure your email yet, try something like this:`,
        '',
        ...GitEmailPolicy.getEmailExampleLines(rushConfiguration),
        ''
      ].join(os.EOL));
      throw new AlreadyReportedError();
    }

    return emailResult.result;
  }

  private static tryGetGitEmail(): IResultOrError<string> {
    const gitPath: string | undefined = Git.getGitPath();
    if (!gitPath) {
      return {
        error: new Error('Git isn\'t present on the path')
      };
    }

    try {
      return {
        result: Utilities.executeCommandAndCaptureOutput(
          'git',
          ['config', 'user.email'],
          '.'
        ).trim()
      };
    } catch (e) {
      return {
        error: e
      };
    }
  }
}
