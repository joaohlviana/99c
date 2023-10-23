import './resources/types/components.d.ts';
import './resources/types/contentTypes.d.ts';
import resources from './resources/index';
import { createTestSetup, destroyTestSetup } from '../../../utils/builder-helper';
import { testInTransaction } from '../../../utils/index';

const ARTICLE_UID = 'api::article.article';

const findArticleDb = async (where: any) => {
  return await strapi.query(ARTICLE_UID).findOne({ where });
};

const findArticlesDb = async (where: any) => {
  return await strapi.query(ARTICLE_UID).findMany({ where });
};

describe('Document Service', () => {
  let testUtils;

  beforeAll(async () => {
    testUtils = await createTestSetup(resources);
  });

  afterAll(async () => {
    await destroyTestSetup(testUtils);
  });

  describe('FindOne', () => {
    it('find one selects by document id', async () => {
      const articleDb = await findArticleDb({ name: '3 Document A' });

      const article = await strapi.documents.findOne(ARTICLE_UID, articleDb.documentId, {
        // locales: 'all',
      });

      expect(article).toMatchObject(articleDb);
    });
  });
});
