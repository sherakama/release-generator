import { getInput, setFailed } from '@actions/core';
import { GitHub } from '@actions/github';
import {
  retrieveLastReleasedVersion, bumpVersion, VersionType,
} from '@minddocdev/mou-release-action/lib/version';
import { run } from '@minddocdev/mou-release-action/main';
import {
  createGithubRelease, renderReleaseBody
} from '@minddocdev/mou-release-action/lib/release';
import { commitParser } from '@minddocdev/mou-release-action/lib/commits';

jest.mock('@actions/github');
jest.mock('@actions/core');
jest.mock('@minddocdev/mou-release-action/lib/commits');
jest.mock('@minddocdev/mou-release-action/lib/release');
jest.mock('@minddocdev/mou-release-action/lib/version');

describe('run', () => {
  // Required input values
  const app = 'fake-app';
  const releaseName = 'fake-app';
  const templatePath = 'RELEASE_DRAFT/default.md';
  const token = 'faketoken';
  // Default input values
  const taskPrefix = 'JIRA-';
  const draft = true;
  const prerelease = true;
  // Template stubs
  const changes = '';
  const nextVersionType = VersionType.patch;
  const tasks = '';
  const pullRequests = '';
  const body = 'releaseBody';

  beforeEach(() => {
    (commitParser as jest.Mock).mockImplementation(() => ({
      changes,
      nextVersionType,
      tasks,
      pullRequests,
    }));
    (renderReleaseBody as jest.Mock).mockImplementation(() => body);
  });

  test('with required params', async () => {
    (getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'app':
          return app;
        case 'draft':
          return `${draft}`;
        case 'prerelease':
          return `${prerelease}`;
        case 'releaseName':
          return releaseName;
        case 'taskPrefix':
          return taskPrefix;
        case 'templatePath':
          return templatePath;
        case 'token':
          return token;
        default:
          return undefined;
      }
    });
    const tagPrefix = 'v';

    const baseRef = 'v1.0.0';
    (retrieveLastReleasedVersion as jest.Mock).mockImplementation(() => baseRef);

    const releaseTag = 'v1.0.5';
    (bumpVersion as jest.Mock).mockImplementation(() => releaseTag);

    await run();

    expect(retrieveLastReleasedVersion).toBeCalledWith(expect.any(GitHub), tagPrefix);
    expect(commitParser).toBeCalledWith(
      expect.any(GitHub),
      baseRef,
      taskPrefix,
      undefined,
      undefined,
    );
    expect(renderReleaseBody).toBeCalledWith(templatePath, app, changes, tasks, pullRequests);
    expect(bumpVersion).toBeCalledWith(token, tagPrefix, nextVersionType);
    expect(createGithubRelease).toBeCalledWith(
      expect.any(GitHub),
      releaseTag,
      releaseName,
      body,
      draft,
      prerelease,
    );
    expect(setFailed).not.toBeCalled();
  });

  test('with specific production release and new release tag', async () => {
    const baseRef = 'v1.0.4';
    const draft = false;
    const prerelease = false;
    const releaseTag = 'v1.0.6';
    const taskBaseUrl = 'https://myfaketask.url';
    (getInput as jest.Mock).mockImplementation((name: string) => {
      switch (name) {
        case 'app':
          return app;
        case 'baseRef':
          return baseRef;
        case 'draft':
          return `${draft}`;
        case 'monorepo':
          return 'true';
        case 'prerelease':
          return `${prerelease}`;
        case 'releaseName':
          return releaseName;
        case 'releaseTag':
          return releaseTag;
        case 'taskBaseUrl':
          return taskBaseUrl;
        case 'taskPrefix':
          return taskPrefix;
        case 'templatePath':
          return templatePath;
        case 'token':
          return token;
        default:
          return undefined;
      }
    });

    await run();

    expect(retrieveLastReleasedVersion).not.toBeCalled();
    expect(commitParser).toBeCalledWith(
      expect.any(GitHub),
      baseRef,
      taskPrefix,
      taskBaseUrl,
      app,
    );
    expect(renderReleaseBody).toBeCalledWith(templatePath, app, changes, tasks, pullRequests);
    expect(bumpVersion).not.toBeCalled();
    expect(createGithubRelease).toBeCalledWith(
      expect.any(GitHub),
      releaseTag,
      releaseName,
      body,
      draft,
      prerelease,
    );
    expect(setFailed).not.toBeCalled();
  });

  test('unexpected error', async () => {
    const errorMsg = 'fake';
    (getInput as jest.Mock).mockImplementation(() => { throw new Error(errorMsg); });

    await run();
    expect(setFailed).toBeCalledWith(errorMsg);
  });
});