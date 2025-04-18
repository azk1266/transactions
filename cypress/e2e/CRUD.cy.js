describe('WordPress Post Lifecycle', () => {
  const baseUrl = 'https://wfeyphieqwpnkkqgyvci.supabase.co/rest/v1';
  const PERFORMANCE_TIMEOUT = 3000;
  const azaPassword = 'Aza6615';
  const azaEmail = 'aza@gmail.com';
  let apiKey;
  let bearerToken;

  beforeEach(() => {
    cy.intercept({
      method: 'POST',
      pathname: '/auth/v1/logout',
      query: { scope: 'global' },
    }).as('signOutRequest');

    cy.visit('https://transactionsmanagerapi.netlify.app/');
    cy.get('input[name=email]').type(azaEmail);
    cy.get('input[name=password]').type(azaPassword);

    cy.get('button').contains('Sign in').click();
    cy.get('button').contains('Sign Out').should('be.visible').click();

    cy.wait('@signOutRequest').then(({ request }) => {
      apiKey = request.headers['apikey'];
      bearerToken = request.headers['authorization'];
    });
  });

  it('uses headers to fetch transactions', function () {
    cy.request({
      method: 'GET',
      url: `${baseUrl}/transactions`,
      headers: {
        apikey: apiKey,
        Authorization: bearerToken,
      },
    }).then((res) => {
      console.log('Transactions:', res.body); // DevTools
      cy.log(`Найдено ${res.body.length} транзакций`);
      expect(res.status).to.eq(200);
      expect(res.body).to.be.an('array');
      console.log(res.body);
    });
  });

  it('should handle full transactiom lifecycle - create, edit, delete', () => {
    let createTime, editTime, deleteTime;
    let createdId;
    const createData = {
      from_user: 'fd1f5aec-d8cc-41b1-99e0-153b1bc7df5d',
      to_user: '74258e9f-5be5-4105-b201-2271411c939c',
      amount: 20.0,
      status: 'pending',
    };
    const createStartTime = Date.now();
    const patchData = {
      status: 'completed',
    };

    const headers = {
      apikey: apiKey,
      Authorization: bearerToken,
      'Content-Type': 'application/json',
      Prefer: 'return=representation', // нужно, чтобы вернулся body после запроса
    };
    // 1. Post a transaction
    cy.request({
      method: 'POST',
      url: `${baseUrl}/transactions`,
      headers,
      body: createData,
    }).then((res) => {
      console.log('A post created:', res.body);
      createTime = Date.now() - createStartTime;
      expect(createTime).to.be.lessThan(
        PERFORMANCE_TIMEOUT,
        'Create operation should be fast'
      );
      expect(res.status).to.eq(201, 'Post should be created');
      expect(res.body).to.be.an('array').with.length(1);
      const transaction = res.body[0];
      createdId = transaction.id;
      expect(transaction.status).to.eq(createData.status);
    });
    // 2. GET by ID
    cy.then(() => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/transactions?id=eq.${createdId}`,
        headers,
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.be.an('array').with.length(1);
        expect(res.body[0].id).to.eq(createdId);
      });
    });
    // 3. PATCH — Update status
    cy.then(() => {
      const editStartTime = Date.now();
      cy.request({
        method: 'PATCH',
        url: `${baseUrl}/transactions?id=eq.${createdId}`,
        headers,
        body: patchData,
      }).then((res) => {
        editTime = Date.now() - editStartTime;
        expect(res.status).to.eq(200);
        expect(editTime).to.be.lessThan(PERFORMANCE_TIMEOUT);
        expect(res.body[0].status).to.eq(patchData.status);
      });
    });
    // 4. DELETE
    cy.then(() => {
      const deleteStartTime = Date.now();
      cy.request({
        method: 'DELETE',
        url: `${baseUrl}/transactions?id=eq.${createdId}`,
        headers: {
          apikey: apiKey,
          Authorization: bearerToken,
        },
      }).then((res) => {
        deleteTime = Date.now() - deleteStartTime;
        expect(res.status).to.eq(204);
        expect(deleteTime).to.be.lessThan(PERFORMANCE_TIMEOUT);
      });
    });

    // 5. Verify DELETED
    cy.then(() => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/transactions?id=eq.${createdId}`,
        headers,
        failOnStatusCode: false, // если вдруг удаление прошло, но вернёт 404
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.be.an('array').that.is.empty;
      });
    });
  });
});
