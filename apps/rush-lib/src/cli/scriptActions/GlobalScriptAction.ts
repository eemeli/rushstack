// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import colors from 'colors/safe';
import * as os from 'os';
import * as path from 'path';

import { FileSystem, IPackageJson, JsonFile, AlreadyReportedError } from '@rushstack/node-core-library';
import { BaseScriptAction, IBaseScriptActionOptions } from './BaseScriptAction';
import { Utilities } from '../../utilities/Utilities';
import { Autoinstaller } from '../../logic/Autoinstaller';

/**
 * Constructor parameters for GlobalScriptAction.
 */
export interface IGlobalScriptActionOptions extends IBaseScriptActionOptions {
  shellCommand: string;
  autoinstallerName: string | undefined;
}

/**
 * This class implements custom commands that are run once globally for the entire repo
 * (versus bulk commands, which run separately for each project).  The action executes
 * a user-defined script file.
 *
 * @remarks
 * Bulk commands can be defined via common/config/command-line.json.  Rush's predefined "build"
 * and "rebuild" commands are also modeled as bulk commands, because they essentially just
 * invoke scripts from package.json in the same way as a custom command.
 */
export class GlobalScriptAction extends BaseScriptAction {
  private readonly _shellCommand: string;
  private readonly _autoinstallerName: string;
  private readonly _autoinstallerFullPath: string;

  public constructor(options: IGlobalScriptActionOptions) {
    super(options);
    this._shellCommand = options.shellCommand;
    this._autoinstallerName = options.autoinstallerName || '';

    if (this._autoinstallerName) {
      Autoinstaller.validateName(this._autoinstallerName);

      // Example: .../common/autoinstallers/my-task
      this._autoinstallerFullPath = path.join(
        this.rushConfiguration.commonAutoinstallersFolder,
        this._autoinstallerName
      );

      if (!FileSystem.exists(this._autoinstallerFullPath)) {
        throw new Error(
          `The custom command "${this.actionName}" specifies an "autoinstallerName" setting` +
            ' but the path does not exist: ' +
            this._autoinstallerFullPath
        );
      }

      // Example: .../common/autoinstallers/my-task/package.json
      const packageJsonPath: string = path.join(this._autoinstallerFullPath, 'package.json');
      if (!FileSystem.exists(packageJsonPath)) {
        throw new Error(
          `The custom command "${this.actionName}" specifies an "autoinstallerName" setting` +
            ` whose package.json file was not found: ` +
            packageJsonPath
        );
      }

      const packageJson: IPackageJson = JsonFile.load(packageJsonPath);

      if (packageJson.name !== this._autoinstallerName) {
        throw new Error(
          `The custom command "${this.actionName}" specifies an "autoinstallerName" setting,` +
            ` but the package.json file's "name" field is not "${this._autoinstallerName}": ` +
            packageJsonPath
        );
      }
    } else {
      this._autoinstallerFullPath = '';
    }
  }

  private async _prepareAutoinstallerName(): Promise<void> {
    const autoInstaller: Autoinstaller = new Autoinstaller(this._autoinstallerName, this.rushConfiguration);

    await autoInstaller.prepareAsync();
  }

  public async runAsync(): Promise<void> {
    const additionalPathFolders: string[] = [];

    if (this._autoinstallerName) {
      await this._prepareAutoinstallerName();

      const autoinstallerNameBinPath: string = path.join(this._autoinstallerFullPath, 'node_modules', '.bin');
      additionalPathFolders.push(autoinstallerNameBinPath);
    }

    // Collect all custom parameter values
    const customParameterValues: string[] = [];

    for (const customParameter of this.customParameters) {
      customParameter.appendToArgList(customParameterValues);
    }

    let shellCommand: string = this._shellCommand;
    if (customParameterValues.length > 0) {
      shellCommand += ' ' + customParameterValues.join(' ');
    }

    const exitCode: number = Utilities.executeLifecycleCommand(shellCommand, {
      rushConfiguration: this.rushConfiguration,
      workingDirectory: this.rushConfiguration.rushJsonFolder,
      initCwd: this.rushConfiguration.commonTempFolder,
      handleOutput: false,
      environmentPathOptions: {
        includeRepoBin: true,
        additionalPathFolders: additionalPathFolders
      }
    });

    process.exitCode = exitCode;

    if (exitCode > 0) {
      console.log(os.EOL + colors.red(`The script failed with exit code ${exitCode}`));
      throw new AlreadyReportedError();
    }
  }

  protected onDefineParameters(): void {
    this.defineScriptParameters();
  }
}
