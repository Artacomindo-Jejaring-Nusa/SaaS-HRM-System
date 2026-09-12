/// <reference types="cypress" />

describe("06. Finance, Projects & Tasks Module", () => {
  beforeEach(() => {
    cy.loginUI("ardhito@artacomindo.com", "password", "Narwasthu");
  });

  it("should display reimbursements management", () => {
    cy.visit("/dashboard/reimbursements");
    cy.url().should("include", "/dashboard/reimbursements");
    cy.get("main").should("be.visible");
  });

  it("should display fund requests management", () => {
    cy.visit("/dashboard/fund-requests");
    cy.url().should("include", "/dashboard/fund-requests");
    cy.get("main").should("be.visible");
  });

  it("should display projects board", () => {
    cy.visit("/dashboard/projects");
    cy.url().should("include", "/dashboard/projects");
    cy.get("main").should("be.visible");
  });

  it("should display tasks management", () => {
    cy.visit("/dashboard/tasks");
    cy.url().should("include", "/dashboard/tasks");
    cy.get("main").should("be.visible");
  });

  it("should display performance appraisals", () => {
    cy.visit("/dashboard/performance");
    cy.url().should("include", "/dashboard/performance");
    cy.get("main").should("be.visible");
  });
});
