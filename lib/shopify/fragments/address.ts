const addressFragment = /* GraphQL */ `
  fragment address on MailingAddress {
    id
    address1
    address2
    city
    company
    country
    firstName
    lastName
    phone
    province
    zip
  }
`;

export default addressFragment;
